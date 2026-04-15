import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InterestCalculationService } from './interest-calculation.service';
import { PenaltyCalculationService } from './penalty-calculation.service';
import {
  EarlySettlementInterestMode,
  LoanStatus,
  LoanType,
} from '@prisma/client';

type ProcessPaymentOptions = {
  isEarlySettlement?: boolean;
  earlySettlementInterestModeOverride?: EarlySettlementInterestMode;
};

@Injectable()
export class PaymentDistributionService {
  private static readonly MONEY_EPSILON = 0.01;
  private static readonly EARLY_SETTLEMENT_ROUNDING_UNIT = 10000;

  constructor(
    private prisma: PrismaService,
    private interestService: InterestCalculationService,
    private penaltyService: PenaltyCalculationService,
  ) {}

  async processPayment(
    loanId: string,
    clientId: string,
    totalAmount: number,
    paymentDate: Date = new Date(),
    options: ProcessPaymentOptions = {},
  ) {
    let loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    if (loan.status !== LoanStatus.ACTIVE) {
      if (loan.type === LoanType.FIXED_INSTALLMENTS && loan.status === LoanStatus.PAID) {
        const { outstandingPrincipal, outstandingBalance } =
          await this.getFixedOutstandingAmounts(loanId, loan);

        if (outstandingBalance > 0) {
          loan = await this.prisma.loan.update({
            where: { id: loanId },
            data: {
              currentPrincipal: outstandingPrincipal,
              status: LoanStatus.ACTIVE,
            },
          });
        } else {
          throw new Error('Cannot make payment on inactive loan');
        }
      } else {
        throw new Error('Cannot make payment on inactive loan');
      }
    }

    if (loan.type === LoanType.MONTHLY_INTEREST) {
      const generatedCount = await this.interestService.ensureMonthlyInterestScheduleUpTo(
        loanId,
        paymentDate,
      );

      if (generatedCount > 0) {
        console.log(`Generated ${generatedCount} monthly interest records for loan ${loanId}`);
      }

      await this.penaltyService.generateMonthlyInterestPenaltiesIncremental(
        loanId,
        paymentDate,
      );
    }

    let remainingAmount = totalAmount;
    let appliedToPenalty = 0;
    let appliedToInterest = 0;
    let appliedToPrincipal = 0;
    let updatedCurrentPrincipal = this.normalizeMoney(loan.currentPrincipal);
    let balanceUsedToDetermineClosure = updatedCurrentPrincipal;
    let fixedOutstandingState:
      | { outstandingPrincipal: number; outstandingBalance: number }
      | null = null;
    let isEarlySettlement = false;
    let earlySettlementInterestModeUsed: EarlySettlementInterestMode | null = null;
    let interestDaysCharged: number | null = null;

    if (loan.type === LoanType.FIXED_INSTALLMENTS) {
      await this.penaltyService.generateFixedInstallmentPenaltiesIncremental(
        loanId,
        paymentDate,
      );

      fixedOutstandingState = await this.getFixedOutstandingAmounts(loanId, loan);
      updatedCurrentPrincipal = fixedOutstandingState.outstandingPrincipal;
      balanceUsedToDetermineClosure = fixedOutstandingState.outstandingBalance;
    }

    if (options.isEarlySettlement) {
      if (loan.type !== LoanType.MONTHLY_INTEREST) {
        throw new BadRequestException(
          'Early settlement is only supported for MONTHLY_INTEREST loans.',
        );
      }

      const earlySettlementResult = await this.processMonthlyEarlySettlement(
        loan,
        totalAmount,
        paymentDate,
        options.earlySettlementInterestModeOverride,
      );

      remainingAmount = earlySettlementResult.remainingAmount;
      appliedToPenalty = earlySettlementResult.appliedToPenalty;
      appliedToInterest = earlySettlementResult.appliedToInterest;
      appliedToPrincipal = earlySettlementResult.appliedToPrincipal;
      updatedCurrentPrincipal = earlySettlementResult.updatedCurrentPrincipal;
      balanceUsedToDetermineClosure = updatedCurrentPrincipal;
      isEarlySettlement = true;
      earlySettlementInterestModeUsed = earlySettlementResult.modeUsed;
      interestDaysCharged = earlySettlementResult.interestDaysCharged;
    } else {
      const totalPendingPenalty = await this.penaltyService.getTotalPendingPenalty(
        loanId,
        paymentDate,
      );

      if (totalPendingPenalty > 0 && remainingAmount > 0) {
        const penaltyResult = await this.penaltyService.applyPaymentToPenalty(
          loanId,
          remainingAmount,
          paymentDate,
        );
        appliedToPenalty = penaltyResult.applied;
        remainingAmount = penaltyResult.remaining;
      }

      if (loan.type === LoanType.FIXED_INSTALLMENTS && remainingAmount > 0) {
        await this.ensureFixedInstallmentInterestSchedule(loanId, loan);

        const { outstandingPrincipal, outstandingBalance } =
          fixedOutstandingState ?? (await this.getFixedOutstandingAmounts(loanId, loan));
        const fixedDistribution = await this.distributeFixedInstallmentPayment(
          loanId,
          remainingAmount,
        );

        if (fixedDistribution.appliedToInterest > 0) {
          const appliedInterest = await this.interestService.applyPaymentToInterest(
            loanId,
            fixedDistribution.appliedToInterest,
          );
          appliedToInterest = this.normalizeMoney(appliedInterest.applied);
        }

        const interestShortfall = this.normalizeMoney(
          fixedDistribution.appliedToInterest - appliedToInterest,
        );
        const adjustedPlannedPrincipal = this.normalizeMoney(
          fixedDistribution.appliedToPrincipal + interestShortfall,
        );
        const remainingAfterInterest = this.normalizeMoney(remainingAmount - appliedToInterest);
        appliedToPrincipal = this.normalizeMoney(
          Math.min(remainingAfterInterest, adjustedPlannedPrincipal),
        );
        remainingAmount = this.normalizeMoney(
          Math.max(0, remainingAfterInterest - appliedToPrincipal),
        );
        updatedCurrentPrincipal = this.normalizeMoney(
          Math.max(0, outstandingPrincipal - appliedToPrincipal),
        );
        balanceUsedToDetermineClosure = this.normalizeMoney(
          Math.max(0, outstandingBalance - appliedToInterest - appliedToPrincipal),
        );
      } else {
        const totalPendingInterest = await this.interestService.getTotalPendingInterest(loanId);

        if (totalPendingInterest > 0 && remainingAmount > 0) {
          const interestResult = await this.interestService.applyPaymentToInterest(
            loanId,
            remainingAmount,
          );
          appliedToInterest = this.normalizeMoney(interestResult.applied);
          remainingAmount = this.normalizeMoney(interestResult.remaining);
        }

        if (remainingAmount > 0) {
          const currentOutstandingPrincipal = await this.getCurrentOutstandingPrincipal(
            loanId,
            loan,
          );
          const amountToApplyToPrincipal = this.normalizeMoney(
            Math.min(remainingAmount, currentOutstandingPrincipal),
          );
          appliedToPrincipal = amountToApplyToPrincipal;
          remainingAmount = this.normalizeMoney(remainingAmount - amountToApplyToPrincipal);

          updatedCurrentPrincipal = this.normalizeMoney(
            currentOutstandingPrincipal - amountToApplyToPrincipal,
          );
          balanceUsedToDetermineClosure = updatedCurrentPrincipal;
        }
      }
    }

    const appliedAnything =
      appliedToPenalty > 0 || appliedToInterest > 0 || appliedToPrincipal > 0;
    const effectivelyClosed = this.isEffectivelyZero(balanceUsedToDetermineClosure);

    if (!appliedAnything && effectivelyClosed) {
      throw new BadRequestException(
        'Payment cannot be applied because the loan is already paid off.',
      );
    }

    if (appliedToInterest > 0 || appliedToPrincipal > 0) {
      await this.prisma.loan.update({
        where: { id: loanId },
        data: {
          currentPrincipal: this.normalizeMoney(updatedCurrentPrincipal),
          status: effectivelyClosed ? LoanStatus.PAID : loan.status,
        },
      });
    }

    const payment = await this.prisma.payment.create({
      data: {
        loanId,
        clientId,
        totalAmount,
        appliedToInterest,
        appliedToPrincipal,
        appliedToPenalty,
        isEarlySettlement,
        earlySettlementInterestModeUsed,
        interestDaysCharged,
        paymentDate,
      },
      include: {
        loan: {
          select: {
            id: true,
            currentPrincipal: true,
            status: true,
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (loan.type === LoanType.FIXED_INSTALLMENTS) {
      await this.markInstallmentsAsPaid(loanId);
    }

    return {
      payment,
      distribution: {
        totalAmount,
        appliedToPenalty,
        appliedToInterest,
        appliedToPrincipal,
        remaining: remainingAmount,
      },
      loanStatus: {
        currentPrincipal: updatedCurrentPrincipal,
        isPaid: effectivelyClosed,
      },
    };
  }

  private async processMonthlyEarlySettlement(
    loan: {
      id: string;
      type: LoanType;
      principalAmount: number;
      currentPrincipal: number;
      installmentAmount: number | null;
      totalInstallments: number | null;
      earlySettlementInterestMode: EarlySettlementInterestMode;
    },
    totalAmount: number,
    paymentDate: Date,
    overrideMode?: EarlySettlementInterestMode,
  ) {
    const paymentDateOnly = this.toUtcDateOnly(paymentDate);
    const modeUsed =
      overrideMode ?? loan.earlySettlementInterestMode ?? EarlySettlementInterestMode.FULL_MONTH;

    const [pendingPenalties, interests, currentOutstandingPrincipal] = await Promise.all([
      this.prisma.loanPenalty.findMany({
        where: {
          loanId: loan.id,
          wasCharged: false,
          OR: [
            { periodEndDate: null },
            { periodEndDate: { lte: paymentDate } },
          ],
        },
        orderBy: { calculatedAt: 'asc' },
      }),
      this.prisma.loanInterest.findMany({
        where: { loanId: loan.id },
        orderBy: { periodStartDate: 'asc' },
        select: {
          id: true,
          periodStartDate: true,
          periodEndDate: true,
          interestAmount: true,
          interestPaid: true,
          interestPending: true,
        },
      }),
      this.getCurrentOutstandingPrincipal(loan.id, loan),
    ]);

    const totalPendingPenalty = this.normalizeMoney(
      pendingPenalties.reduce((sum, penalty) => sum + penalty.penaltyAmount, 0),
    );

    const overdueInterests = interests.filter((interest) => {
      if (interest.interestPending <= PaymentDistributionService.MONEY_EPSILON) {
        return false;
      }

      return this.toUtcDateOnly(interest.periodEndDate) < paymentDateOnly;
    });

    const overdueInterestAmount = this.normalizeMoney(
      overdueInterests.reduce((sum, interest) => sum + interest.interestPending, 0),
    );

    const currentInterest = interests.find((interest) =>
      this.isDateWithinPeriod(paymentDateOnly, interest.periodStartDate, interest.periodEndDate),
    );

    let currentPeriodInterestAmount = 0;
    let currentPeriodAdjustedAmount: number | null = null;
    let interestDaysCharged: number | null = null;

    if (currentInterest) {
      if (modeUsed === EarlySettlementInterestMode.FULL_MONTH) {
        currentPeriodInterestAmount = this.normalizeMoney(currentInterest.interestPending);
      } else {
        interestDaysCharged = Math.min(
          30,
          this.diffDaysUtc(currentInterest.periodStartDate, paymentDateOnly),
        );

        const rawProratedInterest =
          currentInterest.interestAmount * (interestDaysCharged / 30);
        const proratedInterestAmount = this.roundUpToNearest(
          rawProratedInterest,
          PaymentDistributionService.EARLY_SETTLEMENT_ROUNDING_UNIT,
        );

        currentPeriodAdjustedAmount = this.normalizeMoney(
          Math.max(proratedInterestAmount, currentInterest.interestPaid),
        );
        currentPeriodInterestAmount = this.normalizeMoney(
          Math.max(0, currentPeriodAdjustedAmount - currentInterest.interestPaid),
        );
      }
    }

    const totalRequired = this.normalizeMoney(
      totalPendingPenalty +
        overdueInterestAmount +
        currentPeriodInterestAmount +
        currentOutstandingPrincipal,
    );

    if (totalAmount + PaymentDistributionService.MONEY_EPSILON < totalRequired) {
      throw new BadRequestException(
        `Early settlement requires at least ${totalRequired}.`,
      );
    }

    let remainingAmount = this.normalizeMoney(totalAmount);
    let appliedToPenalty = 0;
    let appliedToInterest = 0;

    if (totalPendingPenalty > 0) {
      const penaltyResult = await this.penaltyService.applyPaymentToPenalty(
        loan.id,
        remainingAmount,
        paymentDate,
      );
      appliedToPenalty = this.normalizeMoney(penaltyResult.applied);
      remainingAmount = this.normalizeMoney(penaltyResult.remaining);
    }

    if (overdueInterestAmount > 0) {
      const overdueInterestResult = await this.interestService.applyPaymentToInterest(
        loan.id,
        overdueInterestAmount,
      );
      appliedToInterest = this.normalizeMoney(
        appliedToInterest + overdueInterestResult.applied,
      );
      remainingAmount = this.normalizeMoney(remainingAmount - overdueInterestResult.applied);
    }

    if (
      currentInterest &&
      modeUsed === EarlySettlementInterestMode.PRORATED_BY_DAYS &&
      currentPeriodAdjustedAmount !== null
    ) {
      await this.prisma.loanInterest.update({
        where: { id: currentInterest.id },
        data: {
          interestAmount: currentPeriodAdjustedAmount,
          interestPending: this.normalizeMoney(
            Math.max(0, currentPeriodAdjustedAmount - currentInterest.interestPaid),
          ),
          periodEndDate: paymentDate,
        },
      });
    }

    if (currentPeriodInterestAmount > 0) {
      const currentPeriodInterestResult = await this.interestService.applyPaymentToInterest(
        loan.id,
        currentPeriodInterestAmount,
      );
      appliedToInterest = this.normalizeMoney(
        appliedToInterest + currentPeriodInterestResult.applied,
      );
      remainingAmount = this.normalizeMoney(
        remainingAmount - currentPeriodInterestResult.applied,
      );
    }

    const appliedToPrincipal = this.normalizeMoney(
      Math.min(remainingAmount, currentOutstandingPrincipal),
    );
    remainingAmount = this.normalizeMoney(remainingAmount - appliedToPrincipal);

    const updatedCurrentPrincipal = this.normalizeMoney(
      currentOutstandingPrincipal - appliedToPrincipal,
    );

    if (!this.isEffectivelyZero(updatedCurrentPrincipal)) {
      throw new BadRequestException(
        'Early settlement payment must fully close the loan.',
      );
    }

    await this.cleanupFutureMonthlyArtifactsAfterSettlement(loan.id, paymentDate);

    return {
      remainingAmount,
      appliedToPenalty,
      appliedToInterest,
      appliedToPrincipal,
      updatedCurrentPrincipal,
      modeUsed,
      interestDaysCharged,
    };
  }

  private async cleanupFutureMonthlyArtifactsAfterSettlement(
    loanId: string,
    paymentDate: Date,
  ) {
    await this.prisma.loanPenalty.deleteMany({
      where: {
        loanId,
        wasCharged: false,
        OR: [
          { periodStartDate: { gt: paymentDate } },
          { periodEndDate: { gt: paymentDate } },
        ],
      },
    });

    await this.prisma.loanInterest.deleteMany({
      where: {
        loanId,
        periodStartDate: { gt: paymentDate },
        interestPaid: 0,
      },
    });
  }

  private async markInstallmentsAsPaid(loanId: string) {
    const installments = await this.prisma.installment.findMany({
      where: {
        loanId,
      },
      orderBy: { installmentNumber: 'asc' },
    });

    const paymentsSummary = await this.prisma.payment.aggregate({
      where: { loanId },
      _sum: { appliedToPrincipal: true, appliedToInterest: true },
    });

    let coveredAmount = this.normalizeMoney(
      (paymentsSummary._sum.appliedToPrincipal ?? 0) +
        (paymentsSummary._sum.appliedToInterest ?? 0),
    );

    for (const installment of installments) {
      if (coveredAmount <= 0) break;

      const shouldBePaid =
        coveredAmount + PaymentDistributionService.MONEY_EPSILON >= installment.amount;

      if (shouldBePaid) {
        coveredAmount = this.normalizeMoney(
          Math.max(0, coveredAmount - installment.amount),
        );

        if (installment.status === 'PAID') {
          continue;
        }

        await this.prisma.installment.update({
          where: { id: installment.id },
          data: { status: 'PAID' },
        });
      }
    }
  }

  async simulatePayment(
    loanId: string,
    amount: number,
    paymentDate: Date = new Date(),
    options: ProcessPaymentOptions = {},
  ) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        type: true,
        status: true,
        principalAmount: true,
        currentPrincipal: true,
        installmentAmount: true,
        totalInstallments: true,
        earlySettlementInterestMode: true,
      },
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    if (loan.status !== LoanStatus.ACTIVE) {
      throw new BadRequestException('Cannot simulate payment on inactive loan');
    }

    if (loan.type === LoanType.MONTHLY_INTEREST) {
      await this.interestService.ensureMonthlyInterestScheduleUpTo(
        loanId,
        paymentDate,
      );

      await this.penaltyService.generateMonthlyInterestPenaltiesIncremental(
        loanId,
        paymentDate,
      );
    }

    if (loan.type === LoanType.FIXED_INSTALLMENTS) {
      await this.penaltyService.generateFixedInstallmentPenaltiesIncremental(
        loanId,
        paymentDate,
      );
    }

    if (options.isEarlySettlement) {
      if (loan.type !== LoanType.MONTHLY_INTEREST) {
        throw new BadRequestException(
          'Early settlement is only supported for MONTHLY_INTEREST loans.',
        );
      }

      const preview = await this.previewMonthlyEarlySettlement(
        loan,
        amount,
        paymentDate,
        options.earlySettlementInterestModeOverride,
      );

      return {
        paymentDate,
        operationType: 'EARLY_SETTLEMENT',
        modeUsed: preview.modeUsed,
        isAmountSufficient: preview.isAmountSufficient,
        requiredToClose: preview.requiredToClose,
        interestDaysCharged: preview.interestDaysCharged,
        payoff: {
          penaltyPending: preview.penaltyPending,
          overdueInterestPending: preview.overdueInterestPending,
          currentPeriodInterestForPayoff: preview.currentPeriodInterestForPayoff,
          principalPending: preview.principalPending,
          totalPayoff: preview.requiredToClose,
        },
        distribution: {
          totalAmount: amount,
          appliedToPenalty: preview.appliedToPenalty,
          appliedToInterest: preview.appliedToInterest,
          appliedToPrincipal: preview.appliedToPrincipal,
          remaining: preview.remaining,
        },
        wouldCloseLoan: preview.wouldCloseLoan,
      };
    }

    const totalPendingPenalty = await this.penaltyService.getTotalPendingPenalty(
      loanId,
      paymentDate,
    );

    let remainingAmount = amount;
    let balanceUsedToDetermineClosure =
      loan.type === LoanType.FIXED_INSTALLMENTS
        ? await this.getCurrentOutstandingBalance(loanId, loan)
        : this.normalizeMoney(loan.currentPrincipal);
    const distribution = {
      totalAmount: amount,
      appliedToPenalty: 0,
      appliedToInterest: 0,
      appliedToPrincipal: 0,
      remaining: 0,
    };

    if (totalPendingPenalty > 0 && remainingAmount > 0) {
      const amountToPenalty = Math.min(remainingAmount, totalPendingPenalty);
      distribution.appliedToPenalty = amountToPenalty;
      remainingAmount -= amountToPenalty;
    }

    if (remainingAmount > 0) {
      if (loan.type === LoanType.FIXED_INSTALLMENTS) {
        const currentOutstandingBalance = await this.getCurrentOutstandingBalance(
          loanId,
          loan,
        );
        const fixedDistribution = await this.distributeFixedInstallmentPayment(
          loanId,
          remainingAmount,
        );

        distribution.appliedToInterest = fixedDistribution.appliedToInterest;
        distribution.appliedToPrincipal = fixedDistribution.appliedToPrincipal;
        remainingAmount = fixedDistribution.remaining;
        balanceUsedToDetermineClosure = this.normalizeMoney(
          Math.max(
            0,
            currentOutstandingBalance -
              distribution.appliedToInterest -
              distribution.appliedToPrincipal,
          ),
        );
      } else {
        const totalPendingInterest = await this.interestService.getTotalPendingInterest(loanId);
        if (totalPendingInterest > 0 && remainingAmount > 0) {
          const amountToInterest = Math.min(remainingAmount, totalPendingInterest);
          distribution.appliedToInterest = amountToInterest;
          remainingAmount -= amountToInterest;
        }

        const currentOutstandingPrincipal = await this.getCurrentOutstandingPrincipal(loanId, loan);
        if (remainingAmount > 0) {
          const amountToPrincipal = Math.min(remainingAmount, currentOutstandingPrincipal);
          distribution.appliedToPrincipal = amountToPrincipal;
          remainingAmount -= amountToPrincipal;
        }

        balanceUsedToDetermineClosure = this.normalizeMoney(
          Math.max(0, currentOutstandingPrincipal - distribution.appliedToPrincipal),
        );
      }
    }

    distribution.remaining = remainingAmount;

    return {
      paymentDate,
      operationType: 'REGULAR_PAYMENT',
      modeUsed: null,
      isAmountSufficient: true,
      requiredToClose: null,
      interestDaysCharged: null,
      distribution,
      wouldCloseLoan: this.isEffectivelyZero(balanceUsedToDetermineClosure),
    };
  }

  private async previewMonthlyEarlySettlement(
    loan: {
      id: string;
      type: LoanType;
      principalAmount: number;
      currentPrincipal: number;
      installmentAmount: number | null;
      totalInstallments: number | null;
      earlySettlementInterestMode: EarlySettlementInterestMode | null;
    },
    totalAmount: number,
    paymentDate: Date,
    overrideMode?: EarlySettlementInterestMode,
  ) {
    const paymentDateOnly = this.toUtcDateOnly(paymentDate);
    const modeUsed =
      overrideMode ?? loan.earlySettlementInterestMode ?? EarlySettlementInterestMode.FULL_MONTH;

    const [pendingPenalties, interests, currentOutstandingPrincipal] = await Promise.all([
      this.prisma.loanPenalty.findMany({
        where: {
          loanId: loan.id,
          wasCharged: false,
          OR: [{ periodEndDate: null }, { periodEndDate: { lte: paymentDate } }],
        },
        orderBy: { calculatedAt: 'asc' },
      }),
      this.prisma.loanInterest.findMany({
        where: { loanId: loan.id },
        orderBy: { periodStartDate: 'asc' },
        select: {
          id: true,
          periodStartDate: true,
          periodEndDate: true,
          interestAmount: true,
          interestPaid: true,
          interestPending: true,
        },
      }),
      this.getCurrentOutstandingPrincipal(loan.id, loan),
    ]);

    const penaltyPending = this.normalizeMoney(
      pendingPenalties.reduce((sum, penalty) => sum + penalty.penaltyAmount, 0),
    );

    const overdueInterests = interests.filter((interest) => {
      if (interest.interestPending <= PaymentDistributionService.MONEY_EPSILON) {
        return false;
      }

      return this.toUtcDateOnly(interest.periodEndDate) < paymentDateOnly;
    });

    const overdueInterestPending = this.normalizeMoney(
      overdueInterests.reduce((sum, interest) => sum + interest.interestPending, 0),
    );

    const currentInterest = interests.find((interest) =>
      this.isDateWithinPeriod(paymentDateOnly, interest.periodStartDate, interest.periodEndDate),
    );

    let currentPeriodInterestForPayoff = 0;
    let interestDaysCharged: number | null = null;

    if (currentInterest) {
      if (modeUsed === EarlySettlementInterestMode.FULL_MONTH) {
        currentPeriodInterestForPayoff = this.normalizeMoney(
          currentInterest.interestPending,
        );
      } else {
        interestDaysCharged = Math.min(
          30,
          this.diffDaysUtc(currentInterest.periodStartDate, paymentDateOnly),
        );

        const rawProratedInterest =
          currentInterest.interestAmount * (interestDaysCharged / 30);
        const roundedProratedInterest = this.roundUpToNearest(
          rawProratedInterest,
          PaymentDistributionService.EARLY_SETTLEMENT_ROUNDING_UNIT,
        );
        const adjustedInterestAmount = Math.max(
          roundedProratedInterest,
          currentInterest.interestPaid,
        );

        currentPeriodInterestForPayoff = this.normalizeMoney(
          Math.max(0, adjustedInterestAmount - currentInterest.interestPaid),
        );
      }
    }

    const requiredToClose = this.normalizeMoney(
      penaltyPending +
        overdueInterestPending +
        currentPeriodInterestForPayoff +
        currentOutstandingPrincipal,
    );

    let remaining = this.normalizeMoney(totalAmount);
    const appliedToPenalty = this.normalizeMoney(
      Math.min(remaining, penaltyPending),
    );
    remaining = this.normalizeMoney(remaining - appliedToPenalty);

    const totalInterestToApply = this.normalizeMoney(
      overdueInterestPending + currentPeriodInterestForPayoff,
    );
    const appliedToInterest = this.normalizeMoney(
      Math.min(remaining, totalInterestToApply),
    );
    remaining = this.normalizeMoney(remaining - appliedToInterest);

    const appliedToPrincipal = this.normalizeMoney(
      Math.min(remaining, currentOutstandingPrincipal),
    );
    remaining = this.normalizeMoney(remaining - appliedToPrincipal);

    const isAmountSufficient =
      totalAmount + PaymentDistributionService.MONEY_EPSILON >= requiredToClose;

    return {
      modeUsed,
      interestDaysCharged,
      penaltyPending,
      overdueInterestPending,
      currentPeriodInterestForPayoff,
      principalPending: currentOutstandingPrincipal,
      requiredToClose,
      isAmountSufficient,
      wouldCloseLoan: isAmountSufficient,
      appliedToPenalty,
      appliedToInterest,
      appliedToPrincipal,
      remaining,
    };
  }

  private async getCurrentOutstandingPrincipal(
    loanId: string,
    loan: {
      id: string;
      type: LoanType;
      principalAmount: number;
      currentPrincipal: number;
      installmentAmount: number | null;
      totalInstallments: number | null;
    },
  ): Promise<number> {
    if (loan.type !== LoanType.FIXED_INSTALLMENTS) {
      return loan.currentPrincipal;
    }

    const { outstandingPrincipal } = await this.getFixedOutstandingAmounts(loanId, loan);
    return outstandingPrincipal;
  }

  private async getCurrentOutstandingBalance(
    loanId: string,
    loan: {
      id: string;
      type: LoanType;
      principalAmount: number;
      currentPrincipal: number;
      installmentAmount: number | null;
      totalInstallments: number | null;
    },
  ): Promise<number> {
    if (loan.type !== LoanType.FIXED_INSTALLMENTS) {
      return loan.currentPrincipal;
    }

    const { outstandingBalance } = await this.getFixedOutstandingAmounts(loanId, loan);
    return outstandingBalance;
  }

  private async getFixedOutstandingAmounts(
    loanId: string,
    loan: {
      id: string;
      type: LoanType;
      principalAmount: number;
      currentPrincipal: number;
      installmentAmount: number | null;
      totalInstallments: number | null;
    },
  ): Promise<{ outstandingPrincipal: number; outstandingBalance: number }> {
    const paymentsSummary = await this.prisma.payment.aggregate({
      where: { loanId },
      _sum: { appliedToPrincipal: true, appliedToInterest: true },
    });

    const paidToPrincipal = paymentsSummary._sum.appliedToPrincipal ?? 0;
    const paidToInterest = paymentsSummary._sum.appliedToInterest ?? 0;
    const outstandingPrincipal = this.normalizeMoney(
      Math.max(0, loan.principalAmount - paidToPrincipal),
    );

    if (!loan.installmentAmount || !loan.totalInstallments) {
      return {
        outstandingPrincipal,
        outstandingBalance: this.normalizeMoney(
          Math.max(0, loan.currentPrincipal),
        ),
      };
    }

    const scheduledTotal = loan.installmentAmount * loan.totalInstallments;

    return {
      outstandingPrincipal,
      outstandingBalance: this.normalizeMoney(
        Math.max(0, scheduledTotal - paidToPrincipal - paidToInterest),
      ),
    };
  }

  private async getTotalPendingFixedInterest(
    loanId: string,
    loan: {
      principalAmount: number;
      installmentAmount: number | null;
      totalInstallments: number | null;
    },
  ): Promise<number> {
    if (!loan.installmentAmount || !loan.totalInstallments) {
      return 0;
    }

    const interestsCount = await this.prisma.loanInterest.count({
      where: { loanId },
    });

    if (interestsCount > 0) {
      const interestSummary = await this.prisma.loanInterest.aggregate({
        where: { loanId },
        _sum: { interestPending: true },
      });

      return this.normalizeMoney(interestSummary._sum.interestPending ?? 0);
    }

    const scheduledTotal = loan.installmentAmount * loan.totalInstallments;
    const totalInterestPlanned = Math.max(0, scheduledTotal - loan.principalAmount);

    const paymentsSummary = await this.prisma.payment.aggregate({
      where: { loanId },
      _sum: { appliedToInterest: true },
    });

    const totalInterestPaid = paymentsSummary._sum.appliedToInterest ?? 0;
    return this.normalizeMoney(Math.max(0, totalInterestPlanned - totalInterestPaid));
  }

  private async distributeFixedInstallmentPayment(
    loanId: string,
    paymentAmount: number,
  ): Promise<{ appliedToInterest: number; appliedToPrincipal: number; remaining: number }> {
    if (paymentAmount <= 0) {
      return {
        appliedToInterest: 0,
        appliedToPrincipal: 0,
        remaining: paymentAmount,
      };
    }

    const [installments, loanInterests, paymentsSummary] = await Promise.all([
      this.prisma.installment.findMany({
        where: { loanId },
        orderBy: { installmentNumber: 'asc' },
        select: { amount: true },
      }),
      this.prisma.loanInterest.findMany({
        where: { loanId },
        orderBy: { periodStartDate: 'asc' },
        select: { interestPending: true },
      }),
      this.prisma.payment.aggregate({
        where: { loanId },
        _sum: { appliedToPrincipal: true, appliedToInterest: true },
      }),
    ]);

    if (installments.length === 0) {
      return {
        appliedToInterest: 0,
        appliedToPrincipal: 0,
        remaining: paymentAmount,
      };
    }

    let coveredAmount = this.normalizeMoney(
      (paymentsSummary._sum.appliedToPrincipal ?? 0) +
        (paymentsSummary._sum.appliedToInterest ?? 0),
    );
    let remaining = this.normalizeMoney(paymentAmount);
    let appliedToInterest = 0;
    let appliedToPrincipal = 0;

    for (let index = 0; index < installments.length; index++) {
      if (remaining <= 0) break;

      const installmentAmount = installments[index].amount;
      const coveredForInstallment = this.normalizeMoney(
        Math.min(Math.max(coveredAmount, 0), installmentAmount),
      );
      const installmentPending = this.normalizeMoney(
        Math.max(0, installmentAmount - coveredForInstallment),
      );

      coveredAmount = this.normalizeMoney(
        Math.max(0, coveredAmount - installmentAmount),
      );

      if (installmentPending <= 0) {
        continue;
      }

      const paymentForInstallment = this.normalizeMoney(
        Math.min(remaining, installmentPending),
      );
      const interestPendingForInstallment = this.normalizeMoney(
        loanInterests[index]?.interestPending ?? 0,
      );
      const interestPart = this.normalizeMoney(
        Math.min(paymentForInstallment, interestPendingForInstallment),
      );
      const principalPart = this.normalizeMoney(paymentForInstallment - interestPart);

      appliedToInterest = this.normalizeMoney(appliedToInterest + interestPart);
      appliedToPrincipal = this.normalizeMoney(appliedToPrincipal + principalPart);
      remaining = this.normalizeMoney(remaining - paymentForInstallment);
    }

    return {
      appliedToInterest,
      appliedToPrincipal,
      remaining,
    };
  }

  private async ensureFixedInstallmentInterestSchedule(
    loanId: string,
    loan: {
      type: LoanType;
      principalAmount: number;
      installmentAmount: number | null;
      totalInstallments: number | null;
      startDate: Date;
    },
  ) {
    if (loan.type !== LoanType.FIXED_INSTALLMENTS) {
      return;
    }

    if (!loan.installmentAmount || !loan.totalInstallments) {
      return;
    }

    const existingInterests = await this.prisma.loanInterest.count({
      where: { loanId },
    });

    if (existingInterests > 0) {
      return;
    }

    const installments = await this.prisma.installment.findMany({
      where: { loanId },
      orderBy: { installmentNumber: 'asc' },
      select: {
        dueDate: true,
      },
    });

    if (installments.length === 0) {
      return;
    }

    const scheduledTotal = loan.installmentAmount * loan.totalInstallments;
    const totalInterestPlanned = Math.max(0, scheduledTotal - loan.principalAmount);

    if (totalInterestPlanned <= 0) {
      return;
    }

    const baseInterest = totalInterestPlanned / loan.totalInstallments;
    let accumulatedInterest = 0;

    const interestRows = installments.map((installment, index) => {
      const isLast = index === installments.length - 1;
      const interestAmount = isLast
        ? totalInterestPlanned - accumulatedInterest
        : baseInterest;
      accumulatedInterest += interestAmount;

      const periodStartDate = index === 0
        ? new Date(loan.startDate)
        : new Date(installments[index - 1].dueDate);
      const periodEndDate = new Date(installment.dueDate);

      return {
        loanId,
        periodStartDate,
        periodEndDate,
        interestAmount,
        interestPaid: 0,
        interestPending: interestAmount,
      };
    });

    await this.prisma.loanInterest.createMany({
      data: interestRows,
    });
  }

  private isDateWithinPeriod(
    date: Date,
    periodStartDate: Date,
    periodEndDate: Date,
  ): boolean {
    const normalizedDate = this.toUtcDateOnly(date).getTime();
    const normalizedStart = this.toUtcDateOnly(periodStartDate).getTime();
    const normalizedEnd = this.toUtcDateOnly(periodEndDate).getTime();

    return normalizedStart <= normalizedDate && normalizedDate <= normalizedEnd;
  }

  private toUtcDateOnly(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ));
  }

  private diffDaysUtc(startDate: Date, endDate: Date): number {
    const start = this.toUtcDateOnly(startDate).getTime();
    const end = this.toUtcDateOnly(endDate).getTime();
    const msPerDay = 1000 * 60 * 60 * 24;

    return Math.max(0, Math.floor((end - start) / msPerDay));
  }

  private roundUpToNearest(value: number, unit: number): number {
    if (value <= 0) {
      return 0;
    }

    return Math.ceil(value / unit) * unit;
  }

  private normalizeMoney(value: number): number {
    if (Math.abs(value) < PaymentDistributionService.MONEY_EPSILON) {
      return 0;
    }

    return value;
  }

  private isEffectivelyZero(value: number): boolean {
    return Math.abs(value) < PaymentDistributionService.MONEY_EPSILON;
  }
}
