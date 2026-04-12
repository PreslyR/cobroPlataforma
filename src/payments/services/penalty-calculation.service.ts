import { Injectable } from '@nestjs/common';
import { LoanStatus, LoanType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PenaltyCalculationService {
  private readonly fixedInstallmentPenaltyMonthlyRate = 0.2;
  private readonly monthlyInterestPenaltyMonthlyRate = 0.2;
  private static readonly MONEY_EPSILON = 0.01;

  constructor(private prisma: PrismaService) {}

  /**
   * Calculates a penalty based on late days.
   * The penalty is not auto-capitalized.
   */
  async calculatePenalty(
    loanId: string,
    daysLate: number,
    penaltyRate: number = 0.05,
    installmentId?: string,
    periodStartDate?: Date,
    periodEndDate?: Date,
  ) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    const penaltyAmount = loan.currentPrincipal * penaltyRate * (daysLate / 30);

    return this.prisma.loanPenalty.create({
      data: {
        loanId,
        installmentId,
        daysLate,
        penaltyAmount,
        wasCharged: false,
        periodStartDate,
        periodEndDate,
      },
    });
  }

  /**
   * Generates incremental penalties for overdue fixed-installment dues.
   * Rules:
   * - Penalty base: full overdue installment amount
   * - Monthly rate: fixed 20% (0.2)
   * - Late days: calendar day difference (ignores time-of-day)
   * - Rounding: ceil to the nearest 1000
   * - Incremental: only charge newly elapsed days since last covered date per installment
   */
  async generateFixedInstallmentPenaltiesIncremental(
    loanId: string,
    asOfDate: Date,
    options: { preserveFutureState?: boolean } = {},
  ) {
    const preserveFutureState = options.preserveFutureState ?? false;
    return this.prisma.$transaction(async (tx) => {
      await this.lockLoanRow(tx, loanId);

      const asOf = this.clampToToday(asOfDate);
      const paidInstallmentIds = (
        await tx.installment.findMany({
          where: {
            loanId,
            status: 'PAID',
          },
          select: {
            id: true,
          },
        })
      ).map((installment) => installment.id);

      // If penalties were materialized using a later as-of date and we are now
      // processing/simulating a backdated payment, those future penalties are
      // no longer valid. Drop only the uncharged fixed-installment penalties
      // beyond the requested cutoff, then regenerate up to the effective date.
      if (!preserveFutureState) {
        await tx.loanPenalty.deleteMany({
          where: {
            loanId,
            installmentId: { not: null },
            wasCharged: false,
            OR: [
              { periodEndDate: { gt: asOf } },
              ...(paidInstallmentIds.length > 0
                ? [{ installmentId: { in: paidInstallmentIds } }]
                : []),
            ],
          },
        });

        // If a future as-of date previously marked installments as LATE, restore
        // any still-unpaid dues whose due date has not arrived yet for the
        // effective cutoff we are processing now.
        await tx.installment.updateMany({
          where: {
            loanId,
            status: 'LATE',
            dueDate: { gte: asOf },
          },
          data: {
            status: 'PENDING',
          },
        });
      }

      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        select: {
          id: true,
          type: true,
          installments: {
            where: {
              status: { in: ['PENDING', 'LATE'] },
            },
            orderBy: { dueDate: 'asc' },
            select: {
              id: true,
              dueDate: true,
              amount: true,
              status: true,
            },
          },
        },
      });

      if (!loan) {
        throw new Error('Loan not found');
      }

      if (loan.type !== LoanType.FIXED_INSTALLMENTS) {
        return [];
      }
      const createdPenalties = [];

      for (const installment of loan.installments) {
        const due = this.toDateOnly(installment.dueDate);
        if (asOf <= due) {
          continue;
        }

        if (installment.status === 'PENDING') {
          await tx.installment.update({
            where: { id: installment.id },
            data: { status: 'LATE' },
          });
        }

        const lastCoveredDate = await this.getLatestCoveredDateForInstallment(
          tx,
          installment.id,
        );
        const periodStart = lastCoveredDate
          ? this.toDateOnly(lastCoveredDate)
          : due;

        if (asOf <= periodStart) {
          continue;
        }

        const daysLate = this.diffDays(periodStart, asOf);
        const rawPenalty =
          installment.amount *
          this.fixedInstallmentPenaltyMonthlyRate *
          (daysLate / 30);
        const penaltyAmount = this.roundUpToNearestThousand(rawPenalty);

        if (penaltyAmount <= 0) {
          continue;
        }

        const penalty = await tx.loanPenalty.create({
          data: {
            loanId,
            installmentId: installment.id,
            daysLate,
            penaltyAmount,
            wasCharged: false,
            periodStartDate: periodStart,
            periodEndDate: asOf,
          },
        });

        createdPenalties.push(penalty);
      }

      return createdPenalties;
    });
  }

  /**
   * Generates incremental penalties for overdue monthly-interest periods.
   * Rules:
   * - Penalty base: full interestAmount of the overdue period
   * - Monthly rate: fixed 20% (0.2)
   * - Trigger: period reached periodEndDate and is not fully paid
   * - Materialization is incremental and idempotent per interest period
   */
  async generateMonthlyInterestPenaltiesIncremental(
    loanId: string,
    asOfDate: Date,
    options: { preserveFutureState?: boolean } = {},
  ) {
    const preserveFutureState = options.preserveFutureState ?? false;
    return this.prisma.$transaction(async (tx) => {
      await this.lockLoanRow(tx, loanId);
      const asOf = this.clampToToday(asOfDate);

      if (!preserveFutureState) {
        await tx.loanPenalty.deleteMany({
          where: {
            loanId,
            installmentId: null,
            wasCharged: false,
            periodEndDate: { gt: asOf },
          },
        });
      }

      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        select: {
          id: true,
          status: true,
          type: true,
          interests: {
            orderBy: { periodStartDate: 'asc' },
            select: {
              id: true,
              periodStartDate: true,
              periodEndDate: true,
              interestAmount: true,
              interestPending: true,
            },
          },
        },
      });

      if (!loan) {
        throw new Error('Loan not found');
      }

      if (
        loan.type !== LoanType.MONTHLY_INTEREST ||
        loan.status !== LoanStatus.ACTIVE
      ) {
        return [];
      }
      const createdPenalties = [];

      for (const interest of loan.interests) {
        const dueDate = this.toDateOnly(interest.periodEndDate);

        if (asOf <= dueDate) {
          continue;
        }

        if (interest.interestPending <= PenaltyCalculationService.MONEY_EPSILON) {
          continue;
        }

        const totalDaysLate = this.diffDays(dueDate, asOf);
        const coveredDays =
          await this.getLatestCoveredDaysForMonthlyInterestPeriod(
            tx,
            loanId,
            interest.periodStartDate,
            interest.periodEndDate,
          );

        if (totalDaysLate <= coveredDays) {
          continue;
        }

        const incrementalDaysLate = totalDaysLate - coveredDays;
        const rawPenalty =
          interest.interestAmount *
          this.monthlyInterestPenaltyMonthlyRate *
          (incrementalDaysLate / 30);
        const penaltyAmount = this.roundUpToNearestThousand(rawPenalty);

        if (penaltyAmount <= 0) {
          continue;
        }

        const penalty = await tx.loanPenalty.create({
          data: {
            loanId,
            daysLate: totalDaysLate,
            penaltyAmount,
            wasCharged: false,
            periodStartDate: interest.periodStartDate,
            periodEndDate: interest.periodEndDate,
          },
        });

        createdPenalties.push(penalty);
      }

      return createdPenalties;
    });
  }

  /**
   * Returns total pending (uncharged) penalties for a loan.
   */
  async getTotalPendingPenalty(
    loanId: string,
    upToDate?: Date,
  ): Promise<number> {
    const penalties = await this.prisma.loanPenalty.findMany({
      where: {
        loanId,
        wasCharged: false,
        ...(upToDate && {
          OR: [
            { periodEndDate: null },
            { periodEndDate: { lte: upToDate } },
          ],
        }),
      },
    });

    return penalties.reduce((sum, penalty) => sum + penalty.penaltyAmount, 0);
  }

  /**
   * Applies a payment to pending penalties in FIFO order.
   */
  async applyPaymentToPenalty(
    loanId: string,
    paymentAmount: number,
    upToDate?: Date,
  ): Promise<{ applied: number; remaining: number; penaltiesCharged: string[] }> {
    const penalties = await this.prisma.loanPenalty.findMany({
      where: {
        loanId,
        wasCharged: false,
        ...(upToDate && {
          OR: [
            { periodEndDate: null },
            { periodEndDate: { lte: upToDate } },
          ],
        }),
      },
      orderBy: { calculatedAt: 'asc' },
    });

    let remainingAmount = paymentAmount;
    let totalApplied = 0;
    const penaltiesCharged: string[] = [];

    for (const penalty of penalties) {
      if (remainingAmount <= 0) break;

      if (remainingAmount >= penalty.penaltyAmount) {
        await this.prisma.loanPenalty.update({
          where: { id: penalty.id },
          data: { wasCharged: true },
        });

        totalApplied += penalty.penaltyAmount;
        remainingAmount -= penalty.penaltyAmount;
        penaltiesCharged.push(penalty.id);
      } else {
        const remainingPenalty = penalty.penaltyAmount - remainingAmount;

        await this.prisma.loanPenalty.update({
          where: { id: penalty.id },
          data: { wasCharged: true, penaltyAmount: remainingAmount },
        });

        await this.prisma.loanPenalty.create({
          data: {
            loanId,
            installmentId: penalty.installmentId,
            daysLate: penalty.daysLate,
            penaltyAmount: remainingPenalty,
            wasCharged: false,
            periodStartDate: penalty.periodStartDate,
            periodEndDate: penalty.periodEndDate,
          },
        });

        totalApplied += remainingAmount;
        penaltiesCharged.push(penalty.id);
        remainingAmount = 0;
      }
    }

    return {
      applied: totalApplied,
      remaining: remainingAmount,
      penaltiesCharged,
    };
  }

  /**
   * Returns late days for the oldest overdue pending installment using today's date.
   */
  async calculateDaysLate(loanId: string): Promise<number> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        installments: {
          where: {
            status: 'PENDING',
            dueDate: { lt: new Date() },
          },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
      },
    });

    if (!loan || loan.installments.length === 0) {
      return 0;
    }

    const oldestOverdueInstallment = loan.installments[0];
    const today = this.toDateOnly(new Date());
    const dueDate = this.toDateOnly(oldestOverdueInstallment.dueDate);

    return this.diffDays(dueDate, today);
  }

  private async getLatestCoveredDateForInstallment(
    tx: Prisma.TransactionClient,
    installmentId: string,
  ): Promise<Date | null> {
    const latestPenalty = await tx.loanPenalty.findFirst({
      where: {
        installmentId,
        periodEndDate: { not: null },
      },
      orderBy: {
        periodEndDate: 'desc',
      },
      select: {
        periodEndDate: true,
      },
    });

    return latestPenalty?.periodEndDate ?? null;
  }

  private async getLatestCoveredDaysForMonthlyInterestPeriod(
    tx: Prisma.TransactionClient,
    loanId: string,
    periodStartDate: Date,
    periodEndDate: Date,
  ): Promise<number> {
    const latestPenalty = await tx.loanPenalty.findFirst({
      where: {
        loanId,
        installmentId: null,
        periodStartDate,
        periodEndDate,
      },
      orderBy: [
        { daysLate: 'desc' },
        { calculatedAt: 'desc' },
      ],
      select: {
        daysLate: true,
      },
    });

    return latestPenalty?.daysLate ?? 0;
  }

  private toDateOnly(date: Date): Date {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ));
  }

  private clampToToday(date: Date): Date {
    const normalizedDate = this.toDateOnly(date);
    const today = this.toDateOnly(new Date());

    return normalizedDate > today ? today : normalizedDate;
  }

  private diffDays(start: Date, end: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / msPerDay));
  }

  private roundUpToNearestThousand(value: number): number {
    if (value <= 0) {
      return 0;
    }

    return Math.ceil(value / 1000) * 1000;
  }

  private async lockLoanRow(tx: Prisma.TransactionClient, loanId: string) {
    await tx.$queryRaw`SELECT id FROM "loans" WHERE id = ${loanId} FOR UPDATE`;
  }
}

