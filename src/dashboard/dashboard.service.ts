import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { LoansService } from '../loans/loans.service';
import { PrismaService } from '../prisma/prisma.service';
import { measureAsync } from '../common/perf/perf-logger';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private prisma: PrismaService,
    private loansService: LoansService,
  ) {}

  async getToday(date?: string, lenderId?: string) {
    const asOfDate = this.parseDateOnlyOrNow(date);
    const monthStartDate = new Date(
      Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1),
    );
    const nextDate = this.addDaysUtc(asOfDate, 1);

    const [lender, activeLoanSnapshotsResult, monthInterestIncome, todayCollections] =
      await Promise.all([
        measureAsync(this.logger, 'dashboard.lenderLookup', () =>
          lenderId
            ? this.prisma.lender.findUnique({
                where: { id: lenderId },
                select: { id: true, name: true },
              })
            : Promise.resolve(null),
        ),
        measureAsync(this.logger, 'dashboard.activeLoanSnapshots', () =>
          this.loansService.getActiveLoanSnapshots({
            asOf: asOfDate,
            lenderId,
            logLabel: 'dashboard.activeLoans',
          }),
        ),
        measureAsync(this.logger, 'dashboard.monthInterestIncome', () =>
          this.prisma.payment.aggregate({
            where: {
              paymentDate: {
                gte: monthStartDate,
                lt: nextDate,
              },
              ...(lenderId && {
                loan: {
                  lenderId,
                },
              }),
            },
            _sum: {
              totalAmount: true,
              appliedToInterest: true,
            },
          }),
        ),
        measureAsync(this.logger, 'dashboard.todayCollections', () =>
          this.prisma.payment.aggregate({
            where: {
              paymentDate: {
                gte: asOfDate,
                lt: nextDate,
              },
              ...(lenderId && {
                loan: {
                  lenderId,
                },
              }),
            },
            _sum: {
              totalAmount: true,
              appliedToInterest: true,
              appliedToPenalty: true,
              appliedToPrincipal: true,
            },
            _count: {
              id: true,
            },
          }),
        ),
      ]);

    const { dueToday, overdue, portfolio } = this.buildDashboardSections(
      activeLoanSnapshotsResult.snapshots,
    );

    return {
      date: asOfDate,
      lenderId: lenderId ?? null,
      lenderName: lender?.name ?? null,
      summary: {
        activeLoans: portfolio.totals.activeLoans,
        dueTodayLoans: dueToday.count,
        overdueLoans: overdue.count,
        totalCollectibleToday: portfolio.totals.totalCollectibleToday,
        dueTodayAmount: portfolio.totals.dueTodayAmount,
        overdueAmount: portfolio.totals.overdueAmount,
        outstandingBalance: portfolio.totals.outstandingBalance,
        interestPending: portfolio.totals.interestPending,
        penaltyPending: portfolio.totals.penaltyPending,
        monthInterestIncome: monthInterestIncome._sum.appliedToInterest ?? 0,
        monthCollectedAmount: monthInterestIncome._sum.totalAmount ?? 0,
        todayPaymentsCount: todayCollections._count.id,
        todayCollectedAmount: todayCollections._sum.totalAmount ?? 0,
        todayInterestCollected: todayCollections._sum.appliedToInterest ?? 0,
        todayPenaltyCollected: todayCollections._sum.appliedToPenalty ?? 0,
        todayPrincipalCollected: todayCollections._sum.appliedToPrincipal ?? 0,
      },
      sections: {
        dueToday: dueToday.items,
        overdue: overdue.items,
      },
    };
  }

  private buildDashboardSections(
    snapshots: Array<Awaited<ReturnType<LoansService['getActiveLoanSnapshots']>>['snapshots'][number]>,
  ) {
    const dueTodayItems = [];
    const overdueItems = [];

    let principalPlaced = 0;
    let capitalPending = 0;
    let outstandingBalance = 0;
    let interestPending = 0;
    let penaltyPending = 0;
    let dueTodayAmount = 0;
    let overdueAmount = 0;
    let totalCollectibleToday = 0;
    let dueTodayLoans = 0;
    let overdueLoans = 0;

    for (const snapshot of snapshots) {
      principalPlaced += snapshot.loan.principalAmount;
      capitalPending += snapshot.loan.currentPrincipal;
      outstandingBalance += snapshot.outstandingBalance;
      interestPending += snapshot.interest.totalPending;
      penaltyPending += snapshot.penalty.pending;
      dueTodayAmount += snapshot.dueTodayAmount;
      overdueAmount += snapshot.overdueAmount;
      totalCollectibleToday += snapshot.totalCollectibleToday;

      if (snapshot.dueToday) {
        dueTodayLoans++;
        dueTodayItems.push({
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

      if (snapshot.overdue) {
        overdueLoans++;
        overdueItems.push({
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
    }

    return {
      dueToday: {
        count: dueTodayItems.length,
        items: dueTodayItems,
      },
      overdue: {
        count: overdueItems.length,
        items: overdueItems,
      },
      portfolio: {
        totals: {
          activeLoans: snapshots.length,
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
      },
    };
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
}
