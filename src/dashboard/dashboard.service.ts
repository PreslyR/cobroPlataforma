import { BadRequestException, Injectable } from '@nestjs/common';
import { LoansService } from '../loans/loans.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private loansService: LoansService,
    private reportsService: ReportsService,
  ) {}

  async getToday(date?: string, lenderId?: string) {
    const asOfDate = this.parseDateOnlyOrNow(date);
    const monthStartDate = new Date(
      Date.UTC(asOfDate.getUTCFullYear(), asOfDate.getUTCMonth(), 1),
    );
    const dateKey = this.toDateKey(asOfDate);
    const monthStartKey = this.toDateKey(monthStartDate);
    const nextDate = this.addDaysUtc(asOfDate, 1);

    const [dueToday, overdue, portfolio, monthInterestIncome, todayCollections] =
      await Promise.all([
        this.loansService.getDueToday(dateKey, lenderId),
        this.loansService.getOverdue(dateKey, lenderId),
        this.reportsService.getPortfolioSummary(dateKey, lenderId),
        this.reportsService.getInterestIncome(monthStartKey, dateKey, lenderId),
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
      ]);

    return {
      date: asOfDate,
      lenderId: lenderId ?? null,
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
        monthInterestIncome: monthInterestIncome.totalInterestIncome,
        monthCollectedAmount: monthInterestIncome.totalCollectedAmount,
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

  private toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
