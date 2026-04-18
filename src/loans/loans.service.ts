import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLoanDto } from "./dto/create-loan.dto";
import { UpdateLoanDto } from "./dto/update-loan.dto";
import {
  EarlySettlementInterestMode,
  InstallmentStatus,
  LoanStatus,
  LoanType,
  PaymentFrequency,
} from "@prisma/client";
import { InterestCalculationService } from "../payments/services/interest-calculation.service";
import { PenaltyCalculationService } from "../payments/services/penalty-calculation.service";
import { measureAsync } from '../common/perf/perf-logger';

const DEFAULT_SNAPSHOT_CONCURRENCY = 1;
const MAX_SNAPSHOT_CONCURRENCY = 4;

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private prisma: PrismaService,
    private interestService: InterestCalculationService,
    private penaltyService: PenaltyCalculationService,
  ) {}

  async create(createLoanDto: CreateLoanDto) {
    // Validaciones específicas según tipo de préstamo
    if (createLoanDto.type === LoanType.FIXED_INSTALLMENTS) {
      if (
        !createLoanDto.installmentAmount ||
        !createLoanDto.totalInstallments
      ) {
        throw new BadRequestException(
          "installmentAmount and totalInstallments are required for FIXED_INSTALLMENTS",
        );
      }
    } else {
      if (!createLoanDto.monthlyInterestRate) {
        throw new BadRequestException(
          "monthlyInterestRate is required for DAILY_INTEREST and MONTHLY_INTEREST",
        );
      }
    }

    // currentPrincipal siempre representa capital pendiente real.
    // El saldo contractual del plan se deriva desde cuotas e intereses.
    const initialCurrentPrincipal = createLoanDto.principalAmount;
    const startDate = new Date(createLoanDto.startDate);
    const expectedEndDate =
      createLoanDto.type === LoanType.FIXED_INSTALLMENTS
        ? this.calculateFixedInstallmentsExpectedEndDate(
            startDate,
            createLoanDto.paymentFrequency,
            createLoanDto.totalInstallments!,
          )
        : createLoanDto.expectedEndDate
          ? new Date(createLoanDto.expectedEndDate)
          : null;

    const loanData: any = {
      ...createLoanDto,
      currentPrincipal: initialCurrentPrincipal,
      startDate,
      expectedEndDate,
    };

    // Crear el préstamo
    const loan = await this.prisma.loan.create({
      data: loanData,
      include: {
        lender: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, fullName: true, documentNumber: true },
        },
      },
    });

    // Si es FIXED_INSTALLMENTS, crear las cuotas
    if (createLoanDto.type === LoanType.FIXED_INSTALLMENTS) {
      const installments = await this.generateInstallments(
        loan.id,
        createLoanDto.totalInstallments!,
        createLoanDto.installmentAmount!,
        startDate,
        createLoanDto.paymentFrequency,
      );

      await this.generateFixedInstallmentInterests(
        loan.id,
        createLoanDto.principalAmount,
        startDate,
        createLoanDto.installmentAmount!,
        createLoanDto.totalInstallments!,
        installments,
      );
    }

    return loan;
  }

  private calculateFixedInstallmentsExpectedEndDate(
    startDate: Date,
    frequency: PaymentFrequency,
    totalInstallments: number,
  ): Date {
    return this.calculateNextPaymentDate(
      startDate,
      frequency,
      totalInstallments,
    );
  }

  private async generateInstallments(
    loanId: string,
    totalInstallments: number,
    installmentAmount: number,
    startDate: Date,
    frequency: PaymentFrequency,
  ): Promise<Array<{ dueDate: Date }>> {
    const installments: Array<{
      loanId: string;
      installmentNumber: number;
      dueDate: Date;
      amount: number;
      status: InstallmentStatus;
    }> = [];

    for (let i = 1; i <= totalInstallments; i++) {
      // Calcular fecha de vencimiento según frecuencia
      const dueDate = this.calculateNextPaymentDate(startDate, frequency, i);

      installments.push({
        loanId,
        installmentNumber: i,
        dueDate,
        amount: installmentAmount,
        status: InstallmentStatus.PENDING,
      });
    }

    await this.prisma.installment.createMany({
      data: installments,
    });

    return installments.map((installment) => ({
      dueDate: installment.dueDate,
    }));
  }

  private async generateFixedInstallmentInterests(
    loanId: string,
    principalAmount: number,
    startDate: Date,
    installmentAmount: number,
    totalInstallments: number,
    installments: Array<{ dueDate: Date }>,
  ) {
    const scheduledTotal = installmentAmount * totalInstallments;
    const totalInterestPlanned = Math.max(0, scheduledTotal - principalAmount);

    if (totalInterestPlanned <= 0 || installments.length === 0) {
      return;
    }

    const baseInterest = totalInterestPlanned / totalInstallments;
    let accumulatedInterest = 0;

    const interestRows = installments.map((installment, index) => {
      const isLast = index === installments.length - 1;
      const interestAmount = isLast
        ? totalInterestPlanned - accumulatedInterest
        : baseInterest;
      accumulatedInterest += interestAmount;

      const periodStartDate =
        index === 0
          ? new Date(startDate)
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

  private calculateNextPaymentDate(
    startDate: Date,
    frequency: PaymentFrequency,
    installmentNumber: number,
  ): Date {
    switch (frequency) {
      case PaymentFrequency.DAILY:
        return this.addDaysUtc(startDate, installmentNumber);
      case PaymentFrequency.WEEKLY:
        return this.addDaysUtc(startDate, installmentNumber * 7);
      case PaymentFrequency.BIWEEKLY:
        return this.addDaysUtc(startDate, installmentNumber * 14);
      case PaymentFrequency.MONTHLY:
        return this.addMonthsClampedUtc(startDate, installmentNumber);
    }
  }

  private addDaysUtc(baseDate: Date, days: number): Date {
    return new Date(
      Date.UTC(
        baseDate.getUTCFullYear(),
        baseDate.getUTCMonth(),
        baseDate.getUTCDate() + days,
      ),
    );
  }

  private addMonthsClampedUtc(baseDate: Date, monthsToAdd: number): Date {
    const targetMonthStart = new Date(
      Date.UTC(
        baseDate.getUTCFullYear(),
        baseDate.getUTCMonth() + monthsToAdd,
        1,
      ),
    );

    const targetYear = targetMonthStart.getUTCFullYear();
    const targetMonth = targetMonthStart.getUTCMonth();
    const lastDayOfTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();
    const targetDay = Math.min(baseDate.getUTCDate(), lastDayOfTargetMonth);

    return new Date(Date.UTC(targetYear, targetMonth, targetDay));
  }

  async findAll(lenderId?: string, clientId?: string) {
    return this.prisma.loan.findMany({
      where: {
        ...(lenderId && { lenderId }),
        ...(clientId && { clientId }),
      },
      include: {
        lender: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, fullName: true, documentNumber: true },
        },
        _count: {
          select: {
            interests: true,
            penalties: true,
            payments: true,
            installments: true,
          },
        },
      },
    });
  }

  async getPortfolio(filters: {
    date?: string;
    lenderId?: string;
    status?: string;
    type?: string;
    search?: string;
  }) {
    const typeFilter = this.parsePortfolioLoanType(filters.type);
    const statusFilter = this.parsePortfolioStatus(filters.status);
    const search = filters.search?.trim();
    const { asOfDate, snapshots } = await this.getActiveLoanSnapshots({
      asOf: filters.date,
      lenderId: filters.lenderId,
      type: typeFilter ?? undefined,
      search,
      logLabel: 'loans.getPortfolio',
    });

    const items = [];
    let dueTodayLoans = 0;
    let overdueLoans = 0;
    let currentLoans = 0;

    for (const snapshot of snapshots) {
      const operationalStatus = this.getPortfolioOperationalStatus(snapshot);

      if (operationalStatus === "DUE_TODAY") {
        dueTodayLoans++;
      } else if (operationalStatus === "OVERDUE") {
        overdueLoans++;
      } else {
        currentLoans++;
      }

      if (statusFilter && operationalStatus !== statusFilter) {
        continue;
      }

      items.push({
        loanId: snapshot.loan.id,
        lenderId: snapshot.loan.lenderId,
        clientId: snapshot.loan.clientId,
        clientName: snapshot.loan.clientName,
        type: snapshot.loan.type,
        operationalStatus,
        totalCollectibleToday: snapshot.totalCollectibleToday,
        outstandingBalance: snapshot.outstandingBalance,
        dueTodayAmount: snapshot.dueTodayAmount,
        overdueAmount: snapshot.overdueAmount,
        penaltyPending: snapshot.penalty.pending,
        daysLate: snapshot.overdue ? snapshot.daysLate : null,
        oldestDueDate: snapshot.overdue ? snapshot.oldestDueDate : null,
      });
    }

    items.sort((left, right) => this.comparePortfolioItems(left, right));

    return {
      date: asOfDate,
      lenderId: filters.lenderId ?? null,
      filters: {
        status: statusFilter ?? "ALL",
        type: typeFilter ?? "ALL",
        search: search ?? "",
      },
      summary: {
        activeLoans: snapshots.length,
        dueTodayLoans,
        overdueLoans,
        currentLoans,
        visibleLoans: items.length,
      },
      count: items.length,
      items,
    };
  }

  async findOne(id: string, asOf?: string, lenderId?: string) {
    await this.assertLoanExists(id, lenderId);
    await this.ensureOperationalStateForRead(id, this.parseDateOnlyOrNow(asOf));

    const loan = await this.prisma.loan.findFirst({
      where: {
        id,
        ...(lenderId && { lenderId }),
      },
      include: {
        lender: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, fullName: true, documentNumber: true },
        },
        interests: {
          orderBy: { periodStartDate: "desc" },
        },
        penalties: {
          orderBy: { calculatedAt: "desc" },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        installments: {
          orderBy: { installmentNumber: "asc" },
        },
      },
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    return loan;
  }

  async update(id: string, updateLoanDto: UpdateLoanDto, lenderId?: string) {
    await this.assertLoanExists(id, lenderId);

    const updateData: any = { ...updateLoanDto };

    if (updateLoanDto.startDate) {
      updateData.startDate = new Date(updateLoanDto.startDate);
    }
    if (updateLoanDto.expectedEndDate) {
      updateData.expectedEndDate = new Date(updateLoanDto.expectedEndDate);
    }

    return this.prisma.loan.update({
      where: { id },
      data: updateData,
      include: {
        lender: {
          select: { id: true, name: true },
        },
        client: {
          select: { id: true, fullName: true, documentNumber: true },
        },
      },
    });
  }

  async remove(id: string, lenderId?: string) {
    await this.assertLoanExists(id, lenderId);

    // Cancelar el préstamo (no eliminarlo físicamente)
    return this.prisma.loan.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
  }

  // Método para obtener el resumen financiero de un préstamo
  async getLoanSummary(id: string, asOf?: string, lenderId?: string) {
    const loan = await this.findOne(id, asOf, lenderId);

    // Calcular totales de intereses
    const totalInterestGenerated = loan.interests.reduce(
      (sum, interest) => sum + interest.interestAmount,
      0,
    );
    const totalInterestPaid = loan.interests.reduce(
      (sum, interest) => sum + interest.interestPaid,
      0,
    );
    const totalInterestPending = loan.interests.reduce(
      (sum, interest) => sum + interest.interestPending,
      0,
    );

    // Calcular totales de mora
    const totalPenaltyAmount = loan.penalties.reduce(
      (sum, penalty) => sum + penalty.penaltyAmount,
      0,
    );
    const totalPenaltyCharged = loan.penalties
      .filter((p) => p.wasCharged)
      .reduce((sum, penalty) => sum + penalty.penaltyAmount, 0);

    // Calcular totales de pagos
    const totalPayments = loan.payments.reduce(
      (sum, payment) => sum + payment.totalAmount,
      0,
    );
    const totalAppliedToInterest = loan.payments.reduce(
      (sum, payment) => sum + payment.appliedToInterest,
      0,
    );
    const totalAppliedToPrincipal = loan.payments.reduce(
      (sum, payment) => sum + payment.appliedToPrincipal,
      0,
    );
    const totalAppliedToPenalty = loan.payments.reduce(
      (sum, payment) => sum + payment.appliedToPenalty,
      0,
    );

    return {
      loan: {
        id: loan.id,
        type: loan.type,
        status: loan.status,
        startDate: loan.startDate,
        expectedEndDate: loan.expectedEndDate,
      },
      capital: {
        principalAmount: loan.principalAmount,
        currentPrincipal: loan.currentPrincipal,
        totalPaid: totalAppliedToPrincipal,
      },
      interest: {
        totalGenerated: totalInterestGenerated,
        totalPaid: totalInterestPaid,
        totalPending: totalInterestPending,
      },
      penalty: {
        totalAmount: totalPenaltyAmount,
        totalCharged: totalPenaltyCharged,
        totalPending: totalPenaltyAmount - totalPenaltyCharged,
      },
      payments: {
        totalAmount: totalPayments,
        appliedToInterest: totalAppliedToInterest,
        appliedToPrincipal: totalAppliedToPrincipal,
        appliedToPenalty: totalAppliedToPenalty,
        count: loan.payments.length,
      },
      profit: {
        netProfit: totalInterestPaid + totalPenaltyCharged,
      },
    };
  }

  async getDueToday(date?: string, lenderId?: string) {
    const { asOfDate, snapshots } = await this.getActiveLoanSnapshots({
      asOf: date,
      lenderId,
      logLabel: 'loans.getDueToday',
    });

    const items = [];

    for (const snapshot of snapshots) {
      if (!snapshot.dueToday) {
        continue;
      }

      items.push({
        loanId: snapshot.loan.id,
        lenderId: snapshot.loan.lenderId,
        clientId: snapshot.loan.clientId,
        clientName: snapshot.loan.clientName,
        type: snapshot.loan.type,
        dueTodayAmount: snapshot.dueTodayAmount,
        overdueAmount: snapshot.overdueAmount,
        penaltyPending: snapshot.penalty.pending,
        totalCollectibleToday: snapshot.totalCollectibleToday,
        outstandingBalance: snapshot.outstandingBalance,
      });
    }

    return {
      date: asOfDate,
      count: items.length,
      items,
    };
  }

  async getOverdue(date?: string, lenderId?: string) {
    const { asOfDate, snapshots } = await this.getActiveLoanSnapshots({
      asOf: date,
      lenderId,
      logLabel: 'loans.getOverdue',
    });

    const items = [];

    for (const snapshot of snapshots) {
      if (!snapshot.overdue) {
        continue;
      }

      items.push({
        loanId: snapshot.loan.id,
        lenderId: snapshot.loan.lenderId,
        clientId: snapshot.loan.clientId,
        clientName: snapshot.loan.clientName,
        type: snapshot.loan.type,
        overdueAmount: snapshot.overdueAmount,
        penaltyPending: snapshot.penalty.pending,
        totalCollectibleToday: snapshot.totalCollectibleToday,
        oldestDueDate: snapshot.oldestDueDate,
        daysLate: snapshot.daysLate,
      });
    }

    return {
      date: asOfDate,
      count: items.length,
      items,
    };
  }

  async getActiveLoanSnapshots(filters: {
    asOf?: string | Date;
    lenderId?: string;
    type?: LoanType;
    search?: string;
    logLabel?: string;
  }) {
    const asOfDate = this.resolveAsOfDate(filters.asOf);
    const normalizedSearch = filters.search?.trim();
    const logLabel = filters.logLabel ?? 'loans.getActiveLoanSnapshots';

    const loans = await measureAsync(this.logger, `${logLabel}.listActiveLoanIds`, () =>
      this.prisma.loan.findMany({
        where: {
          status: LoanStatus.ACTIVE,
          ...(filters.lenderId && { lenderId: filters.lenderId }),
          ...(filters.type && { type: filters.type }),
          ...(normalizedSearch && {
            client: {
              is: {
                fullName: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
            },
          }),
        },
        select: { id: true },
      }),
    );

    const snapshots = await this.buildLoanDebtSnapshotsForLoanIds(
      loans.map((loan) => loan.id),
      asOfDate,
      logLabel,
    );

    return {
      asOfDate,
      snapshots,
    };
  }

  async getDebtBreakdown(id: string, asOf?: string, lenderId?: string) {
    await this.assertLoanExists(id, lenderId);
    const asOfDate = this.parseDateOnlyOrNow(asOf);
    const snapshot = await this.buildLoanDebtSnapshot(id, asOfDate);

    return {
      loan: snapshot.loan,
      asOfDate,
      penalty: snapshot.penalty,
      interest: snapshot.interest,
      installments: snapshot.installments,
      outstandingBalance: snapshot.outstandingBalance,
      dueTodayAmount: snapshot.dueTodayAmount,
      overdueAmount: snapshot.overdueAmount,
      totalCollectibleToday: snapshot.totalCollectibleToday,
      dueToday: snapshot.dueToday,
      overdue: snapshot.overdue,
      oldestDueDate: snapshot.oldestDueDate,
      daysLate: snapshot.daysLate,
    };
  }

  async getPayoffPreview(
    id: string,
    paymentDate?: string,
    mode?: string,
    lenderId?: string,
  ) {
    await this.assertLoanExists(id, lenderId);
    const asOfDate = this.parseDateOnlyOrNow(paymentDate);
    const snapshot = await this.buildLoanDebtSnapshot(id, asOfDate);
    const modeUsed =
      snapshot.loan.type === LoanType.MONTHLY_INTEREST
        ? (this.parseEarlySettlementMode(mode) ??
          snapshot.loan.earlySettlementInterestMode)
        : null;

    if (snapshot.loan.type === LoanType.FIXED_INSTALLMENTS) {
      const totalPayoff = this.normalizeMoney(
        snapshot.penalty.pending + snapshot.outstandingBalance,
      );

      return {
        loan: snapshot.loan,
        paymentDate: asOfDate,
        modeUsed: null,
        penaltyPending: snapshot.penalty.pending,
        principalPending: snapshot.outstandingBalance,
        totalPayoff,
      };
    }

    if (snapshot.loan.type === LoanType.MONTHLY_INTEREST) {
      let currentPeriodInterestForPayoff = 0;
      let interestDaysCharged: number | null = null;
      let settlementInterestBase = snapshot.interest.dueTodayPending;

      if (snapshot.interest.currentPeriod) {
        settlementInterestBase = 0;

        if (modeUsed === EarlySettlementInterestMode.FULL_MONTH) {
          currentPeriodInterestForPayoff =
            snapshot.interest.currentPeriod.interestPending;
        } else {
          interestDaysCharged = Math.min(
            30,
            this.diffDaysUtc(
              snapshot.interest.currentPeriod.periodStartDate,
              asOfDate,
            ),
          );

          const rawProratedInterest =
            snapshot.interest.currentPeriod.interestAmount *
            (interestDaysCharged / 30);
          const roundedProratedInterest = this.roundUpToNearest(
            rawProratedInterest,
            10000,
          );
          const adjustedInterestAmount = Math.max(
            roundedProratedInterest,
            snapshot.interest.currentPeriod.interestPaid,
          );

          currentPeriodInterestForPayoff = this.normalizeMoney(
            Math.max(
              0,
              adjustedInterestAmount -
                snapshot.interest.currentPeriod.interestPaid,
            ),
          );
        }
      }

      const totalPayoff = this.normalizeMoney(
        snapshot.penalty.pending +
          snapshot.interest.overduePending +
          settlementInterestBase +
          currentPeriodInterestForPayoff +
          snapshot.loan.currentPrincipal,
      );

      return {
        loan: snapshot.loan,
        paymentDate: asOfDate,
        modeUsed,
        penaltyPending: snapshot.penalty.pending,
        overdueInterestPending: snapshot.interest.overduePending,
        dueTodayInterestPending: snapshot.interest.dueTodayPending,
        currentPeriodInterestForPayoff,
        principalPending: snapshot.loan.currentPrincipal,
        interestDaysCharged,
        totalPayoff,
      };
    }

    const totalPayoff = this.normalizeMoney(
      snapshot.penalty.pending +
        snapshot.interest.totalPending +
        snapshot.loan.currentPrincipal,
    );

    return {
      loan: snapshot.loan,
      paymentDate: asOfDate,
      modeUsed: null,
      penaltyPending: snapshot.penalty.pending,
      interestPending: snapshot.interest.totalPending,
      principalPending: snapshot.loan.currentPrincipal,
      totalPayoff,
    };
  }

  private async buildLoanDebtSnapshot(id: string, asOfDate: Date) {
    const normalizedAsOfDate = this.toUtcDateOnly(asOfDate);
    await measureAsync(
      this.logger,
      `loans.buildLoanDebtSnapshot(${id}).ensureOperationalState`,
      () =>
        this.ensureOperationalStateForRead(id, normalizedAsOfDate, {
          repairFixedInstallmentCurrentPrincipal: false,
        }),
    );

    const loan = await measureAsync(
      this.logger,
      `loans.buildLoanDebtSnapshot(${id}).loadLoanBase`,
      () =>
        this.prisma.loan.findUnique({
          where: { id },
          select: {
            id: true,
            lenderId: true,
            clientId: true,
            type: true,
            status: true,
            principalAmount: true,
            currentPrincipal: true,
            monthlyInterestRate: true,
            installmentAmount: true,
            totalInstallments: true,
            paymentFrequency: true,
            earlySettlementInterestMode: true,
            startDate: true,
            expectedEndDate: true,
            client: {
              select: {
                fullName: true,
              },
            },
          },
        }),
    );

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    const { pendingPenalties, interests } = await measureAsync(
      this.logger,
      `loans.buildLoanDebtSnapshot(${id}).loadPenaltiesAndInterests`,
      async () => {
        const pendingPenalties = await this.prisma.loanPenalty.findMany({
          where: {
            loanId: id,
            wasCharged: false,
            OR: [
              { periodEndDate: null },
              { periodEndDate: { lte: normalizedAsOfDate } },
            ],
          },
          orderBy: { calculatedAt: "asc" },
          select: {
            id: true,
            penaltyAmount: true,
            periodEndDate: true,
          },
        });
        const interests = await this.prisma.loanInterest.findMany({
          where: { loanId: id },
          orderBy: { periodStartDate: "asc" },
          select: {
            id: true,
            periodStartDate: true,
            periodEndDate: true,
            interestAmount: true,
            interestPaid: true,
            interestPending: true,
          },
        });

        return {
          pendingPenalties,
          interests,
        };
      },
    );

    const penaltyPending = this.normalizeMoney(
      pendingPenalties.reduce((sum, penalty) => sum + penalty.penaltyAmount, 0),
    );
    const oldestPendingPenaltyDate =
      pendingPenalties.find((penalty) => penalty.periodEndDate)
        ?.periodEndDate ?? null;

    const totalInterestGenerated = this.normalizeMoney(
      interests.reduce((sum, interest) => sum + interest.interestAmount, 0),
    );
    const totalInterestPaid = this.normalizeMoney(
      interests.reduce((sum, interest) => sum + interest.interestPaid, 0),
    );
    const totalInterestPending = this.normalizeMoney(
      interests.reduce((sum, interest) => sum + interest.interestPending, 0),
    );
    const overdueInterestRows = interests.filter(
      (interest) =>
        interest.interestPending > 0 &&
        this.toUtcDateOnly(interest.periodEndDate) < normalizedAsOfDate,
    );
    const dueTodayInterestRows = interests.filter(
      (interest) =>
        interest.interestPending > 0 &&
        this.isSameUtcDate(interest.periodEndDate, normalizedAsOfDate),
    );
    const currentPeriod =
      interests.find((interest) =>
        this.isDateWithinPeriod(
          normalizedAsOfDate,
          interest.periodStartDate,
          interest.periodEndDate,
        ),
      ) ?? null;
    const overdueInterestPending = this.normalizeMoney(
      overdueInterestRows.reduce(
        (sum, interest) => sum + interest.interestPending,
        0,
      ),
    );
    const dueTodayInterestPending = this.normalizeMoney(
      dueTodayInterestRows.reduce(
        (sum, interest) => sum + interest.interestPending,
        0,
      ),
    );
    const oldestOverdueInterestDate =
      overdueInterestRows[0]?.periodEndDate ?? null;

    if (loan.type === LoanType.FIXED_INSTALLMENTS) {
      const { installments, paymentsSummary } = await measureAsync(
        this.logger,
        `loans.buildLoanDebtSnapshot(${id}).loadInstallmentsAndPayments`,
        async () => {
          const installments = await this.prisma.installment.findMany({
            where: { loanId: id },
            orderBy: { installmentNumber: "asc" },
            select: {
              id: true,
              installmentNumber: true,
              dueDate: true,
              amount: true,
              status: true,
            },
          });
          const paymentsSummary = await this.prisma.payment.aggregate({
            where: { loanId: id },
            _sum: { appliedToPrincipal: true, appliedToInterest: true },
          });

          return {
            installments,
            paymentsSummary,
          };
        },
      );

      let coveredAmount = this.normalizeMoney(
        (paymentsSummary._sum.appliedToPrincipal ?? 0) +
          (paymentsSummary._sum.appliedToInterest ?? 0),
      );
      const outstandingPrincipal = this.normalizeMoney(
        Math.max(0, loan.principalAmount - (paymentsSummary._sum.appliedToPrincipal ?? 0)),
      );
      let totalPendingInstallmentAmount = 0;
      let dueTodayAmount = 0;
      let overdueAmount = 0;
      let dueTodayCount = 0;
      let overdueCount = 0;
      let oldestOverdueDate: Date | null = null;

      for (const installment of installments) {
        const coveredForInstallment = this.normalizeMoney(
          Math.min(Math.max(coveredAmount, 0), installment.amount),
        );
        const installmentPending = this.normalizeMoney(
          Math.max(0, installment.amount - coveredForInstallment),
        );

        coveredAmount = this.normalizeMoney(
          Math.max(0, coveredAmount - installment.amount),
        );

        if (installmentPending <= 0) {
          continue;
        }

        totalPendingInstallmentAmount = this.normalizeMoney(
          totalPendingInstallmentAmount + installmentPending,
        );

        const dueDate = this.toUtcDateOnly(installment.dueDate);

        if (dueDate < normalizedAsOfDate) {
          overdueAmount = this.normalizeMoney(
            overdueAmount + installmentPending,
          );
          overdueCount++;
          oldestOverdueDate ??= installment.dueDate;
        } else if (this.isSameUtcDate(dueDate, normalizedAsOfDate)) {
          dueTodayAmount = this.normalizeMoney(
            dueTodayAmount + installmentPending,
          );
          dueTodayCount++;
        }
      }

      const fallbackOldestDueDate =
        oldestOverdueDate ?? oldestPendingPenaltyDate;
      const dueToday = dueTodayAmount > 0;
      const overdue = overdueAmount > 0 || penaltyPending > 0;

      return {
        loan: {
          ...loan,
          clientName: loan.client.fullName,
          currentPrincipal: outstandingPrincipal,
        },
        penalty: {
          pending: penaltyPending,
          pendingCount: pendingPenalties.length,
          oldestPendingDueDate: oldestPendingPenaltyDate,
        },
        interest: {
          totalGenerated: totalInterestGenerated,
          totalPaid: totalInterestPaid,
          totalPending: totalInterestPending,
          overduePending: overdueInterestPending,
          dueTodayPending: dueTodayInterestPending,
          currentPeriod,
        },
        installments: {
          totalPending: totalPendingInstallmentAmount,
          dueTodayAmount,
          overdueAmount,
          dueTodayCount,
          overdueCount,
        },
        outstandingBalance: totalPendingInstallmentAmount,
        dueTodayAmount,
        overdueAmount,
        totalCollectibleToday: this.normalizeMoney(
          penaltyPending + overdueAmount + dueTodayAmount,
        ),
        dueToday,
        overdue,
        oldestDueDate: fallbackOldestDueDate,
        daysLate: fallbackOldestDueDate
          ? this.diffDaysUtc(fallbackOldestDueDate, normalizedAsOfDate)
          : 0,
      };
    }

    const dueTodayAmount = dueTodayInterestPending;
    const overdueAmount = overdueInterestPending;
    const oldestDueDate = oldestOverdueInterestDate ?? oldestPendingPenaltyDate;
    const currentPrincipalPending = this.normalizeMoney(loan.currentPrincipal);

    return {
      loan: {
        ...loan,
        clientName: loan.client.fullName,
      },
      penalty: {
        pending: penaltyPending,
        pendingCount: pendingPenalties.length,
        oldestPendingDueDate: oldestPendingPenaltyDate,
      },
      interest: {
        totalGenerated: totalInterestGenerated,
        totalPaid: totalInterestPaid,
        totalPending: totalInterestPending,
        overduePending: overdueInterestPending,
        dueTodayPending: dueTodayInterestPending,
        currentPeriod,
      },
      installments: {
        totalPending: 0,
        dueTodayAmount: 0,
        overdueAmount: 0,
        dueTodayCount: 0,
        overdueCount: 0,
      },
      outstandingBalance: currentPrincipalPending,
      dueTodayAmount,
      overdueAmount,
      totalCollectibleToday: this.normalizeMoney(
        penaltyPending + overdueAmount + dueTodayAmount,
      ),
      dueToday: dueTodayAmount > 0,
      overdue: overdueAmount > 0 || penaltyPending > 0,
      oldestDueDate,
      daysLate: oldestDueDate
        ? this.diffDaysUtc(oldestDueDate, normalizedAsOfDate)
        : 0,
    };
  }

  private async buildLoanDebtSnapshotsForLoanIds(
    loanIds: string[],
    asOfDate: Date,
    logLabel: string,
  ) {
    const snapshots = [];
    const snapshotConcurrency = this.getSnapshotConcurrency();

    await measureAsync(this.logger, `${logLabel}.snapshots x${loanIds.length}`, async () => {
      for (let index = 0; index < loanIds.length; index += snapshotConcurrency) {
        const batchIds = loanIds.slice(index, index + snapshotConcurrency);
        const batchSnapshots = await Promise.all(
          batchIds.map((loanId) => this.buildLoanDebtSnapshot(loanId, asOfDate)),
        );

        snapshots.push(...batchSnapshots);
      }
    });

    return snapshots;
  }

  private getSnapshotConcurrency() {
    const configuredValue = Number(
      process.env.LOAN_SNAPSHOT_CONCURRENCY ?? DEFAULT_SNAPSHOT_CONCURRENCY,
    );

    if (!Number.isFinite(configuredValue)) {
      return DEFAULT_SNAPSHOT_CONCURRENCY;
    }

    return Math.max(
      1,
      Math.min(Math.floor(configuredValue), MAX_SNAPSHOT_CONCURRENCY),
    );
  }

  private parseDateOnlyOrNow(value?: string): Date {
    if (!value) {
      return this.toUtcDateOnly(new Date());
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return this.clampToToday(
        new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
      );
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`Invalid date value: ${value}`);
    }

    return this.clampToToday(parsedDate);
  }

  private resolveAsOfDate(value?: string | Date): Date {
    if (!value) {
      return this.toUtcDateOnly(new Date());
    }

    if (typeof value === 'string') {
      return this.parseDateOnlyOrNow(value);
    }

    return this.clampToToday(value);
  }

  private parsePortfolioStatus(
    value?: string,
  ): "DUE_TODAY" | "OVERDUE" | "CURRENT" | null {
    if (!value || value === "ALL") {
      return null;
    }

    if (value === "DUE_TODAY" || value === "OVERDUE" || value === "CURRENT") {
      return value;
    }

    throw new BadRequestException(`Invalid portfolio status: ${value}`);
  }

  private parsePortfolioLoanType(value?: string): LoanType | null {
    if (!value || value === "ALL") {
      return null;
    }

    if (value === LoanType.FIXED_INSTALLMENTS) {
      return LoanType.FIXED_INSTALLMENTS;
    }

    if (value === LoanType.MONTHLY_INTEREST) {
      return LoanType.MONTHLY_INTEREST;
    }

    throw new BadRequestException(`Invalid portfolio loan type: ${value}`);
  }

  private parseEarlySettlementMode(
    mode?: string,
  ): EarlySettlementInterestMode | null {
    if (!mode) {
      return null;
    }

    if (mode === EarlySettlementInterestMode.FULL_MONTH) {
      return EarlySettlementInterestMode.FULL_MONTH;
    }

    if (mode === EarlySettlementInterestMode.PRORATED_BY_DAYS) {
      return EarlySettlementInterestMode.PRORATED_BY_DAYS;
    }

    throw new BadRequestException(`Invalid early settlement mode: ${mode}`);
  }

  private async assertLoanExists(id: string, lenderId?: string) {
    const loan = await this.prisma.loan.findFirst({
      where: {
        id,
        ...(lenderId && { lenderId }),
      },
      select: { id: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
  }

  private async ensureOperationalStateForRead(
    id: string,
    asOfDate: Date = new Date(),
    options: { repairFixedInstallmentCurrentPrincipal?: boolean } = {},
  ) {
    const repairFixedInstallmentCurrentPrincipal =
      options.repairFixedInstallmentCurrentPrincipal ?? true;
    const loan = await measureAsync(
      this.logger,
      `loans.ensureOperationalStateForRead(${id}).loadLoanState`,
      () =>
        this.prisma.loan.findUnique({
          where: { id },
          select: {
            id: true,
            type: true,
            status: true,
          },
        }),
    );

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }

    if (loan.status !== LoanStatus.ACTIVE) {
      return;
    }

    const normalizedAsOfDate = this.toUtcDateOnly(asOfDate);
    const today = this.toUtcDateOnly(new Date());
    const preserveFutureState = normalizedAsOfDate < today;

    if (loan.type === LoanType.MONTHLY_INTEREST) {
      await measureAsync(
        this.logger,
        `loans.ensureOperationalStateForRead(${id}).ensureMonthlyInterestSchedule`,
        () =>
          this.interestService.ensureMonthlyInterestScheduleUpTo(
            id,
            normalizedAsOfDate,
          ),
      );

      await measureAsync(
        this.logger,
        `loans.ensureOperationalStateForRead(${id}).generateMonthlyInterestPenalties`,
        () =>
          this.penaltyService.generateMonthlyInterestPenaltiesIncremental(
            id,
            normalizedAsOfDate,
            { preserveFutureState },
          ),
      );

      return;
    }

    if (loan.type === LoanType.FIXED_INSTALLMENTS) {
      await measureAsync(
        this.logger,
        `loans.ensureOperationalStateForRead(${id}).generateFixedInstallmentPenalties`,
        () =>
          this.penaltyService.generateFixedInstallmentPenaltiesIncremental(
            id,
            normalizedAsOfDate,
            { preserveFutureState },
          ),
      );

      if (repairFixedInstallmentCurrentPrincipal) {
        await measureAsync(
          this.logger,
          `loans.ensureOperationalStateForRead(${id}).syncFixedInstallmentCurrentPrincipal`,
          () => this.syncFixedInstallmentCurrentPrincipal(id),
        );
      }
    }
  }

  private async syncFixedInstallmentCurrentPrincipal(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        principalAmount: true,
        currentPrincipal: true,
      },
    });

    if (!loan || loan.type !== LoanType.FIXED_INSTALLMENTS) {
      return;
    }

    const paymentsSummary = await this.prisma.payment.aggregate({
      where: { loanId: id },
      _sum: { appliedToPrincipal: true },
    });

    const outstandingPrincipal = this.normalizeMoney(
      Math.max(0, loan.principalAmount - (paymentsSummary._sum.appliedToPrincipal ?? 0)),
    );

    if (
      Math.abs(this.normalizeMoney(loan.currentPrincipal) - outstandingPrincipal) <= 0.01
    ) {
      return;
    }

    await this.prisma.loan.update({
      where: { id },
      data: {
        currentPrincipal: outstandingPrincipal,
      },
    });
  }

  private toUtcDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private clampToToday(date: Date): Date {
    const normalizedDate = this.toUtcDateOnly(date);
    const today = this.toUtcDateOnly(new Date());

    return normalizedDate > today ? today : normalizedDate;
  }

  private isSameUtcDate(left: Date, right: Date): boolean {
    return (
      this.toUtcDateOnly(left).getTime() === this.toUtcDateOnly(right).getTime()
    );
  }

  private diffDaysUtc(startDate: Date, endDate: Date): number {
    const start = this.toUtcDateOnly(startDate).getTime();
    const end = this.toUtcDateOnly(endDate).getTime();
    const msPerDay = 1000 * 60 * 60 * 24;

    return Math.max(0, Math.floor((end - start) / msPerDay));
  }

  private getPortfolioOperationalStatus(snapshot: {
    dueToday: boolean;
    overdue: boolean;
  }): "DUE_TODAY" | "OVERDUE" | "CURRENT" {
    if (snapshot.overdue) {
      return "OVERDUE";
    }

    if (snapshot.dueToday) {
      return "DUE_TODAY";
    }

    return "CURRENT";
  }

  private comparePortfolioItems(
    left: {
      operationalStatus: "DUE_TODAY" | "OVERDUE" | "CURRENT";
      daysLate: number | null;
      totalCollectibleToday: number;
      outstandingBalance: number;
      clientName: string;
    },
    right: {
      operationalStatus: "DUE_TODAY" | "OVERDUE" | "CURRENT";
      daysLate: number | null;
      totalCollectibleToday: number;
      outstandingBalance: number;
      clientName: string;
    },
  ) {
    const statusPriority = {
      OVERDUE: 0,
      DUE_TODAY: 1,
      CURRENT: 2,
    } as const;

    const statusDiff =
      statusPriority[left.operationalStatus] -
      statusPriority[right.operationalStatus];

    if (statusDiff !== 0) {
      return statusDiff;
    }

    if (
      left.operationalStatus === "OVERDUE" ||
      right.operationalStatus === "OVERDUE"
    ) {
      const daysLateDiff = (right.daysLate ?? 0) - (left.daysLate ?? 0);
      if (daysLateDiff !== 0) {
        return daysLateDiff;
      }
    }

    const collectibleDiff =
      right.totalCollectibleToday - left.totalCollectibleToday;
    if (collectibleDiff !== 0) {
      return collectibleDiff;
    }

    const outstandingDiff = right.outstandingBalance - left.outstandingBalance;
    if (outstandingDiff !== 0) {
      return outstandingDiff;
    }

    return left.clientName.localeCompare(right.clientName, "es");
  }

  private roundUpToNearest(value: number, unit: number): number {
    if (value <= 0) {
      return 0;
    }

    const roundedValue = Math.round(value * 1000000) / 1000000;
    return Math.ceil(roundedValue / unit) * unit;
  }

  private normalizeMoney(value: number): number {
    if (Math.abs(value) < 0.01) {
      return 0;
    }

    return value;
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
}

