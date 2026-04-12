import { Injectable, Logger } from '@nestjs/common';
import { LoanStatus, LoanType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { measureAsync } from '../../common/perf/perf-logger';

@Injectable()
export class InterestCalculationService {
  private static readonly MONEY_EPSILON = 0.01;
  private readonly logger = new Logger(InterestCalculationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculates and records interest for a loan period.
   * Interest is tracked separately and never capitalized automatically.
   */
  async calculateAndGenerateInterest(
    loanId: string,
    periodStartDate: Date,
    periodEndDate: Date,
  ) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    let interestAmount = 0;

    switch (loan.type) {
      case LoanType.DAILY_INTEREST:
        interestAmount = this.calculateDailyInterest(
          loan.currentPrincipal,
          loan.monthlyInterestRate!,
          periodStartDate,
          periodEndDate,
        );
        break;

      case LoanType.MONTHLY_INTEREST:
        interestAmount = this.calculateMonthlyInterest(
          loan.currentPrincipal,
          loan.monthlyInterestRate!,
        );
        break;

      case LoanType.FIXED_INSTALLMENTS:
        return null;
    }

    return this.prisma.loanInterest.create({
      data: {
        loanId,
        periodStartDate,
        periodEndDate,
        interestAmount,
        interestPaid: 0,
        interestPending: interestAmount,
      },
    });
  }

  /**
   * Ensures monthly-interest periods exist up to the requested cutoff date.
   * Missing periods are created without duplicating existing ones.
   */
  async ensureMonthlyInterestScheduleUpTo(
    loanId: string,
    asOfDate: Date,
  ): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      await measureAsync(
        this.logger,
        `interest.monthly(${loanId}).lockLoanRow`,
        () => this.lockLoanRow(tx, loanId),
      );
      const effectiveAsOfDate = this.clampToToday(asOfDate);

      const loan = await measureAsync(
        this.logger,
        `interest.monthly(${loanId}).loadLoan`,
        () =>
          tx.loan.findUnique({
            where: { id: loanId },
            select: {
              id: true,
              status: true,
              type: true,
              startDate: true,
              principalAmount: true,
              monthlyInterestRate: true,
            },
          }),
      );

      if (!loan) {
        throw new Error('Loan not found');
      }

      if (
        loan.type !== LoanType.MONTHLY_INTEREST ||
        loan.status !== LoanStatus.ACTIVE
      ) {
        return 0;
      }

      const [latestCoveredInterest, futureUnpaidInterestsCount] =
        await measureAsync(
          this.logger,
          `interest.monthly(${loanId}).checkCoverage`,
          () =>
            Promise.all([
              tx.loanInterest.findFirst({
                where: {
                  loanId,
                  periodStartDate: { lte: effectiveAsOfDate },
                },
                orderBy: { periodStartDate: 'desc' },
                select: {
                  periodEndDate: true,
                },
              }),
              tx.loanInterest.count({
                where: {
                  loanId,
                  periodStartDate: { gt: effectiveAsOfDate },
                  interestPaid: 0,
                },
              }),
            ]),
        );

      if (
        futureUnpaidInterestsCount === 0 &&
        latestCoveredInterest &&
        this.toUtcDateOnly(latestCoveredInterest.periodEndDate) >=
          effectiveAsOfDate
      ) {
        return 0;
      }

      await measureAsync(
        this.logger,
        `interest.monthly(${loanId}).deleteFutureUnpaidInterests`,
        () =>
          tx.loanInterest.deleteMany({
            where: {
              loanId,
              periodStartDate: { gt: effectiveAsOfDate },
              interestPaid: 0,
            },
          }),
      );

      const [existingInterests, payments] = await measureAsync(
        this.logger,
        `interest.monthly(${loanId}).loadExistingInterestsAndPayments`,
        () =>
          Promise.all([
            tx.loanInterest.findMany({
              where: { loanId },
              orderBy: { periodStartDate: 'asc' },
              select: {
                periodStartDate: true,
              },
            }),
            tx.payment.findMany({
              where: { loanId },
              orderBy: { paymentDate: 'asc' },
              select: {
                paymentDate: true,
                appliedToPrincipal: true,
              },
            }),
          ]),
      );

      const existingPeriodKeys = new Set(
        existingInterests.map((interest) =>
          this.toDateKey(interest.periodStartDate),
        ),
      );

      const periodsToCreate = await measureAsync(
        this.logger,
        `interest.monthly(${loanId}).resolvePeriodsToCreate`,
        async () =>
          this.resolveMonthlyPeriodsToCreate(
            loan.startDate,
            effectiveAsOfDate,
            existingPeriodKeys,
          ),
      );

      if (periodsToCreate.length === 0) {
        return 0;
      }

      const sortedPayments = payments.map((payment) => ({
        paymentDate: new Date(payment.paymentDate),
        appliedToPrincipal: payment.appliedToPrincipal,
      }));

      let paymentIndex = 0;
      let principalPaidBeforePeriod = 0;

      const interestRows = periodsToCreate.map(
        ({ periodStartDate, periodEndDate }) => {
          while (
            paymentIndex < sortedPayments.length &&
            sortedPayments[paymentIndex].paymentDate <= periodStartDate
          ) {
            principalPaidBeforePeriod +=
              sortedPayments[paymentIndex].appliedToPrincipal;
            paymentIndex++;
          }

          const principalAtPeriodStart = this.normalizeMoney(
            Math.max(0, loan.principalAmount - principalPaidBeforePeriod),
          );
          const interestAmount = this.normalizeMoney(
            this.calculateMonthlyInterest(
              principalAtPeriodStart,
              loan.monthlyInterestRate ?? 0,
            ),
          );

          return {
            loanId,
            periodStartDate,
            periodEndDate,
            interestAmount,
            interestPaid: 0,
            interestPending: interestAmount,
          };
        },
      );

      if (interestRows.length > 0) {
        await measureAsync(
          this.logger,
          `interest.monthly(${loanId}).createInterests x${interestRows.length}`,
          () =>
            tx.loanInterest.createMany({
              data: interestRows,
            }),
        );
      }

      return interestRows.length;
    });
  }

  /**
   * Backward-compatible wrapper kept for existing payment flow.
   */
  async generatePendingMonthlyInterests(
    loanId: string,
    upToDate: Date,
  ): Promise<number> {
    return this.ensureMonthlyInterestScheduleUpTo(loanId, upToDate);
  }

  private calculateDailyInterest(
    principal: number,
    monthlyRate: number,
    startDate: Date,
    endDate: Date,
  ): number {
    const days = this.getDaysBetween(startDate, endDate);
    const dailyRate = monthlyRate / 30;
    return principal * dailyRate * days;
  }

  private calculateMonthlyInterest(
    principal: number,
    monthlyRate: number,
  ): number {
    return principal * monthlyRate;
  }

  private getDaysBetween(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async getTotalPendingInterest(loanId: string): Promise<number> {
    const interests = await this.prisma.loanInterest.findMany({
      where: { loanId },
    });

    return this.normalizeMoney(
      interests.reduce((sum, interest) => sum + interest.interestPending, 0),
    );
  }

  /**
   * Applies payments to pending interests FIFO by period.
   */
  async applyPaymentToInterest(
    loanId: string,
    paymentAmount: number,
  ): Promise<{ applied: number; remaining: number }> {
    const interests = await this.prisma.loanInterest.findMany({
      where: {
        loanId,
        interestPending: { gt: 0 },
      },
      orderBy: { periodStartDate: 'asc' },
    });

    let remainingAmount = paymentAmount;
    let totalApplied = 0;

    for (const interest of interests) {
      if (remainingAmount <= 0) break;

      const amountToApply = Math.min(remainingAmount, interest.interestPending);
      const normalizedAmountToApply = this.normalizeMoney(amountToApply);
      const nextInterestPaid = this.normalizeMoney(
        interest.interestPaid + normalizedAmountToApply,
      );
      const nextInterestPending = this.normalizeMoney(
        interest.interestPending - normalizedAmountToApply,
      );

      await this.prisma.loanInterest.update({
        where: { id: interest.id },
        data: {
          interestPaid: nextInterestPaid,
          interestPending: nextInterestPending,
        },
      });

      totalApplied = this.normalizeMoney(totalApplied + normalizedAmountToApply);
      remainingAmount = this.normalizeMoney(remainingAmount - normalizedAmountToApply);
    }

    return {
      applied: totalApplied,
      remaining: remainingAmount,
    };
  }

  private resolveMonthlyPeriodsToCreate(
    startDate: Date,
    asOfDate: Date,
    existingPeriodKeys: Set<string>,
  ): Array<{ periodStartDate: Date; periodEndDate: Date }> {
    const periods: Array<{ periodStartDate: Date; periodEndDate: Date }> = [];
    const cutoffDate = new Date(asOfDate);
    let monthOffset = 0;

    while (true) {
      const currentPeriodStart = this.addMonthsClampedUtc(startDate, monthOffset);
      if (currentPeriodStart >= cutoffDate) {
        break;
      }

      const periodKey = this.toDateKey(currentPeriodStart);

      if (!existingPeriodKeys.has(periodKey)) {
        const periodEndDate = this.addMonthsClampedUtc(startDate, monthOffset + 1);

        periods.push({
          periodStartDate: new Date(currentPeriodStart),
          periodEndDate,
        });
      }

      monthOffset++;
    }

    return periods;
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

  private toDateKey(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
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

  private normalizeMoney(value: number): number {
    if (Math.abs(value) < InterestCalculationService.MONEY_EPSILON) {
      return 0;
    }

    return value;
  }

  private async lockLoanRow(tx: Prisma.TransactionClient, loanId: string) {
    await tx.$queryRaw`SELECT id FROM "loans" WHERE id = ${loanId} FOR UPDATE`;
  }
}
