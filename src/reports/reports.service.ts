import { BadRequestException, Injectable } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { LoansService } from '../loans/loans.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private loansService: LoansService,
  ) {}

  async getInterestIncome(from?: string, to?: string, lenderId?: string) {
    const fromDate = this.parseRequiredDateOnly(from, 'from');
    const toDate = this.parseRequiredDateOnly(to, 'to');

    const where = this.buildPaymentRangeWhere(fromDate, toDate, lenderId);

    const [paymentCount, totals] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({
        where,
        _sum: {
          totalAmount: true,
          appliedToInterest: true,
        },
      }),
    ]);

    return {
      from: fromDate,
      to: toDate,
      lenderId: lenderId ?? null,
      paymentsCount: paymentCount,
      totalCollectedAmount: totals._sum.totalAmount ?? 0,
      totalInterestIncome: totals._sum.appliedToInterest ?? 0,
    };
  }

  async getPenaltyIncome(from?: string, to?: string, lenderId?: string) {
    const fromDate = this.parseRequiredDateOnly(from, 'from');
    const toDate = this.parseRequiredDateOnly(to, 'to');
    const where = this.buildPaymentRangeWhere(fromDate, toDate, lenderId);

    const [paymentCount, totals] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.aggregate({
        where,
        _sum: {
          totalAmount: true,
          appliedToPenalty: true,
        },
      }),
    ]);

    return {
      from: fromDate,
      to: toDate,
      lenderId: lenderId ?? null,
      paymentsCount: paymentCount,
      totalCollectedAmount: totals._sum.totalAmount ?? 0,
      totalPenaltyIncome: totals._sum.appliedToPenalty ?? 0,
    };
  }

  async getPortfolioSummary(asOf?: string, lenderId?: string) {
    const asOfDate = this.parseDateOnlyOrNow(asOf);
    const asOfKey = this.toDateKey(asOfDate);
    const loans = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.ACTIVE,
        ...(lenderId && { lenderId }),
      },
      select: {
        id: true,
        principalAmount: true,
      },
    });

    let dueTodayLoans = 0;
    let overdueLoans = 0;
    let principalPlaced = 0;
    let capitalPending = 0;
    let outstandingBalance = 0;
    let interestPending = 0;
    let penaltyPending = 0;
    let dueTodayAmount = 0;
    let overdueAmount = 0;
    let totalCollectibleToday = 0;

    for (const loan of loans) {
      const snapshot = await this.loansService.getDebtBreakdown(loan.id, asOfKey);

      principalPlaced += loan.principalAmount;
      capitalPending += snapshot.loan.currentPrincipal;
      outstandingBalance += snapshot.outstandingBalance;
      interestPending += snapshot.interest.totalPending;
      penaltyPending += snapshot.penalty.pending;
      dueTodayAmount += snapshot.dueTodayAmount;
      overdueAmount += snapshot.overdueAmount;
      totalCollectibleToday += snapshot.totalCollectibleToday;

      if (snapshot.dueToday) {
        dueTodayLoans++;
      }

      if (snapshot.overdue) {
        overdueLoans++;
      }
    }

    return {
      asOfDate,
      lenderId: lenderId ?? null,
      totals: {
        activeLoans: loans.length,
        dueTodayLoans,
        overdueLoans,
        principalPlaced,
        capitalPending,
        outstandingBalance,
        interestPending,
        penaltyPending,
        pendingTotal: capitalPending + interestPending + penaltyPending,
        dueTodayAmount,
        overdueAmount,
        totalCollectibleToday,
      },
    };
  }

  async getPaymentsHistory(
    from?: string,
    to?: string,
    lenderId?: string,
    limit: number = 20,
  ) {
    const fromDate = this.parseRequiredDateOnly(from, 'from');
    const toDate = this.parseRequiredDateOnly(to, 'to');
    const where = this.buildPaymentRangeWhere(fromDate, toDate, lenderId);

    const [totalCount, payments] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        select: {
          id: true,
          loanId: true,
          clientId: true,
          totalAmount: true,
          appliedToInterest: true,
          appliedToPrincipal: true,
          appliedToPenalty: true,
          paymentDate: true,
          createdAt: true,
          isEarlySettlement: true,
          earlySettlementInterestModeUsed: true,
          interestDaysCharged: true,
          client: {
            select: {
              fullName: true,
            },
          },
          loan: {
            select: {
              type: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      from: fromDate,
      to: toDate,
      lenderId: lenderId ?? null,
      totalCount,
      limit,
      items: payments.map((payment) => ({
        id: payment.id,
        loanId: payment.loanId,
        clientId: payment.clientId,
        clientName: payment.client.fullName,
        loanType: payment.loan.type,
        loanStatus: payment.loan.status,
        totalAmount: payment.totalAmount,
        appliedToInterest: payment.appliedToInterest,
        appliedToPrincipal: payment.appliedToPrincipal,
        appliedToPenalty: payment.appliedToPenalty,
        paymentDate: payment.paymentDate,
        createdAt: payment.createdAt,
        isEarlySettlement: payment.isEarlySettlement,
        earlySettlementInterestModeUsed: payment.earlySettlementInterestModeUsed,
        interestDaysCharged: payment.interestDaysCharged,
      })),
    };
  }

  async getClosedLoans(
    from?: string,
    to?: string,
    lenderId?: string,
    limit: number = 20,
  ) {
    const fromDate = this.parseRequiredDateOnly(from, 'from');
    const toDate = this.parseRequiredDateOnly(to, 'to');
    this.assertValidRange(fromDate, toDate);
    const endExclusive = this.addDaysUtc(toDate, 1);

    const loans = await this.prisma.loan.findMany({
      where: {
        status: LoanStatus.PAID,
        ...(lenderId && { lenderId }),
      },
      select: {
        id: true,
        clientId: true,
        type: true,
        principalAmount: true,
        startDate: true,
        expectedEndDate: true,
        updatedAt: true,
        client: {
          select: {
            fullName: true,
          },
        },
        payments: {
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: {
            id: true,
            totalAmount: true,
            appliedToInterest: true,
            appliedToPrincipal: true,
            appliedToPenalty: true,
            paymentDate: true,
            isEarlySettlement: true,
          },
        },
      },
    });

    const closedLoans = loans
      .map((loan) => {
        const lastPayment = loan.payments[0] ?? null;
        const closedAt = lastPayment?.paymentDate ?? this.toUtcDateOnly(loan.updatedAt);

        return {
          loanId: loan.id,
          clientId: loan.clientId,
          clientName: loan.client.fullName,
          loanType: loan.type,
          principalAmount: loan.principalAmount,
          startDate: loan.startDate,
          expectedEndDate: loan.expectedEndDate,
          closedAt,
          finalPaymentAmount: lastPayment?.totalAmount ?? 0,
          finalAppliedToInterest: lastPayment?.appliedToInterest ?? 0,
          finalAppliedToPrincipal: lastPayment?.appliedToPrincipal ?? 0,
          finalAppliedToPenalty: lastPayment?.appliedToPenalty ?? 0,
          wasEarlySettlement: lastPayment?.isEarlySettlement ?? false,
        };
      })
      .filter(
        (loan) => loan.closedAt >= fromDate && loan.closedAt < endExclusive,
      )
      .sort((left, right) => right.closedAt.getTime() - left.closedAt.getTime());

    return {
      from: fromDate,
      to: toDate,
      lenderId: lenderId ?? null,
      totalCount: closedLoans.length,
      limit,
      items: closedLoans.slice(0, limit),
    };
  }

  private parseRequiredDateOnly(value: string | undefined, label: string): Date {
    if (!value) {
      throw new BadRequestException(`"${label}" is required.`);
    }

    return this.parseDateOnlyOrNow(value);
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

  private buildPaymentRangeWhere(fromDate: Date, toDate: Date, lenderId?: string) {
    this.assertValidRange(fromDate, toDate);
    const endExclusive = this.addDaysUtc(toDate, 1);

    return {
      paymentDate: {
        gte: fromDate,
        lt: endExclusive,
      },
      ...(lenderId && {
        loan: {
          lenderId,
        },
      }),
    };
  }

  private assertValidRange(fromDate: Date, toDate: Date) {
    if (fromDate > toDate) {
      throw new BadRequestException('"from" cannot be later than "to".');
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

  private toUtcDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );
  }

  private clampToToday(date: Date): Date {
    const normalizedDate = this.toUtcDateOnly(date);
    const today = this.toUtcDateOnly(new Date());

    return normalizedDate > today ? today : normalizedDate;
  }

  private toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
