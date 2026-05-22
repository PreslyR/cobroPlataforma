import { Injectable } from '@nestjs/common';
import { InstallmentStatus, LoanStatus, LoanType } from '@prisma/client';

export type AccrualProjectionLoan = {
  id: string;
  type: LoanType;
  status: LoanStatus;
  principalAmount: number;
  monthlyInterestRate: number | null;
  startDate: Date;
};

export type AccrualProjectionInterestRow = {
  id: string;
  periodStartDate: Date;
  periodEndDate: Date;
  interestAmount: number;
  interestPaid: number;
  interestPending: number;
};

export type AccrualProjectionPenaltyRow = {
  id: string;
  loanId?: string;
  installmentId: string | null;
  daysLate: number;
  penaltyAmount: number;
  wasCharged: boolean;
  calculatedAt?: Date;
  periodStartDate: Date | null;
  periodEndDate: Date | null;
};

export type AccrualProjectionInstallmentRow = {
  id: string;
  dueDate: Date;
  amount: number;
  status: InstallmentStatus;
};

export type AccrualProjectionPaymentRow = {
  paymentDate: Date;
  appliedToPrincipal: number;
};

export type AccrualProjectionResult = {
  interests: AccrualProjectionInterestRow[];
  pendingPenalties: AccrualProjectionPenaltyRow[];
};

@Injectable()
export class AccrualProjectionService {
  private static readonly MONEY_EPSILON = 0.01;
  private readonly fixedInstallmentPenaltyMonthlyRate = 0.2;
  private readonly monthlyInterestPenaltyMonthlyRate = 0.2;

  projectLoanAccruals(params: {
    loan: AccrualProjectionLoan;
    asOfDate: Date;
    interests: AccrualProjectionInterestRow[];
    penalties: AccrualProjectionPenaltyRow[];
    installments?: AccrualProjectionInstallmentRow[];
    payments?: AccrualProjectionPaymentRow[];
  }): AccrualProjectionResult {
    const asOfDate = this.clampToToday(params.asOfDate);
    const interests = this.projectInterests({
      loan: params.loan,
      asOfDate,
      interests: params.interests,
      payments: params.payments ?? [],
    });
    const pendingPenalties =
      params.loan.type === LoanType.FIXED_INSTALLMENTS
        ? this.projectFixedInstallmentPenalties({
            loanId: params.loan.id,
            asOfDate,
            installments: params.installments ?? [],
            penalties: params.penalties,
          })
        : this.projectMonthlyInterestPenalties({
            loanId: params.loan.id,
            asOfDate,
            interests,
            penalties: params.penalties,
          });

    return {
      interests,
      pendingPenalties,
    };
  }

  private projectInterests(params: {
    loan: AccrualProjectionLoan;
    asOfDate: Date;
    interests: AccrualProjectionInterestRow[];
    payments: AccrualProjectionPaymentRow[];
  }) {
    const { loan, asOfDate, interests, payments } = params;
    const effectiveInterests = interests
      .filter((interest) => this.toUtcDateOnly(interest.periodStartDate) < asOfDate)
      .map((interest) => ({ ...interest }))
      .sort(
        (left, right) =>
          left.periodStartDate.getTime() - right.periodStartDate.getTime(),
      );

    if (
      loan.type !== LoanType.MONTHLY_INTEREST ||
      loan.status !== LoanStatus.ACTIVE
    ) {
      return effectiveInterests;
    }

    const existingPeriodKeys = new Set(
      interests.map((interest) => this.toDateKey(interest.periodStartDate)),
    );
    const periodsToCreate = this.resolveMonthlyPeriodsToCreate(
      loan.startDate,
      asOfDate,
      existingPeriodKeys,
    );

    if (periodsToCreate.length === 0) {
      return effectiveInterests;
    }

    const sortedPayments = payments
      .map((payment) => ({
        paymentDate: new Date(payment.paymentDate),
        appliedToPrincipal: payment.appliedToPrincipal,
      }))
      .sort(
        (left, right) => left.paymentDate.getTime() - right.paymentDate.getTime(),
      );

    let paymentIndex = 0;
    let principalPaidBeforePeriod = 0;
    const projectedInterests = periodsToCreate.map(
      ({ periodStartDate, periodEndDate }) => {
        while (
          paymentIndex < sortedPayments.length &&
          sortedPayments[paymentIndex].paymentDate <= periodStartDate
        ) {
          principalPaidBeforePeriod = this.normalizeMoney(
            principalPaidBeforePeriod +
              sortedPayments[paymentIndex].appliedToPrincipal,
          );
          paymentIndex++;
        }

        const principalAtPeriodStart = this.normalizeMoney(
          Math.max(0, loan.principalAmount - principalPaidBeforePeriod),
        );
        const interestAmount = this.normalizeMoney(
          principalAtPeriodStart * (loan.monthlyInterestRate ?? 0),
        );

        return {
          id: `projected-interest:${loan.id}:${this.toDateKey(periodStartDate)}`,
          periodStartDate,
          periodEndDate,
          interestAmount,
          interestPaid: 0,
          interestPending: interestAmount,
        };
      },
    );

    return [...effectiveInterests, ...projectedInterests].sort(
      (left, right) =>
        left.periodStartDate.getTime() - right.periodStartDate.getTime(),
    );
  }

  private projectFixedInstallmentPenalties(params: {
    loanId: string;
    asOfDate: Date;
    installments: AccrualProjectionInstallmentRow[];
    penalties: AccrualProjectionPenaltyRow[];
  }) {
    const { loanId, asOfDate, installments, penalties } = params;
    const pendingPenalties = penalties
      .filter((penalty) => {
        if (penalty.wasCharged) {
          return false;
        }

        if (penalty.periodEndDate === null) {
          return true;
        }

        return this.toUtcDateOnly(penalty.periodEndDate) <= asOfDate;
      })
      .map((penalty) => ({ ...penalty }));
    const latestCoveredDatesByInstallmentId = new Map<string, Date>();

    for (const penalty of penalties) {
      if (!penalty.installmentId || !penalty.periodEndDate) {
        continue;
      }

      const coverageEndDate = this.toUtcDateOnly(penalty.periodEndDate);
      if (coverageEndDate > asOfDate) {
        continue;
      }

      const latestCoveredDate = latestCoveredDatesByInstallmentId.get(
        penalty.installmentId,
      );

      if (!latestCoveredDate || coverageEndDate > latestCoveredDate) {
        latestCoveredDatesByInstallmentId.set(
          penalty.installmentId,
          coverageEndDate,
        );
      }
    }

    const projectedPenalties: AccrualProjectionPenaltyRow[] = [];

    for (const installment of installments) {
      if (installment.status === InstallmentStatus.PAID) {
        continue;
      }

      const dueDate = this.toUtcDateOnly(installment.dueDate);
      if (asOfDate <= dueDate) {
        continue;
      }

      const periodStartDate =
        latestCoveredDatesByInstallmentId.get(installment.id) ?? dueDate;
      if (asOfDate <= periodStartDate) {
        continue;
      }

      const daysLate = this.diffDays(periodStartDate, asOfDate);
      const penaltyAmount = this.roundUpToNearestThousand(
        installment.amount *
          this.fixedInstallmentPenaltyMonthlyRate *
          (daysLate / 30),
      );

      if (penaltyAmount <= AccrualProjectionService.MONEY_EPSILON) {
        continue;
      }

      projectedPenalties.push({
        id: `projected-penalty:${loanId}:${installment.id}:${this.toDateKey(asOfDate)}`,
        loanId,
        installmentId: installment.id,
        daysLate,
        penaltyAmount,
        wasCharged: false,
        periodStartDate,
        periodEndDate: asOfDate,
      });
    }

    return [...pendingPenalties, ...projectedPenalties].sort((left, right) => {
      const leftDate = left.periodEndDate?.getTime() ?? 0;
      const rightDate = right.periodEndDate?.getTime() ?? 0;

      return leftDate - rightDate;
    });
  }

  private projectMonthlyInterestPenalties(params: {
    loanId: string;
    asOfDate: Date;
    interests: AccrualProjectionInterestRow[];
    penalties: AccrualProjectionPenaltyRow[];
  }) {
    const { loanId, asOfDate, interests, penalties } = params;
    const genericPendingPenalties = penalties
      .filter(
        (penalty) =>
          !penalty.wasCharged &&
          penalty.installmentId === null &&
          penalty.periodStartDate === null &&
          penalty.periodEndDate === null,
      )
      .map((penalty) => ({ ...penalty }));
    const periodPenalties = penalties.filter(
      (penalty) =>
        penalty.installmentId === null &&
        penalty.periodStartDate !== null &&
        penalty.periodEndDate !== null,
    );
    const pendingPenalties: AccrualProjectionPenaltyRow[] = [
      ...genericPendingPenalties,
    ];

    for (const interest of interests) {
      const dueDate = this.toUtcDateOnly(interest.periodEndDate);

      if (asOfDate <= dueDate) {
        continue;
      }

      if (interest.interestPending <= AccrualProjectionService.MONEY_EPSILON) {
        continue;
      }

      const penaltiesForPeriod = periodPenalties
        .filter(
          (penalty) =>
            penalty.periodStartDate &&
            penalty.periodEndDate &&
            this.isSameUtcDate(penalty.periodStartDate, interest.periodStartDate) &&
            this.isSameUtcDate(penalty.periodEndDate, interest.periodEndDate),
        )
        .sort((left, right) => left.daysLate - right.daysLate);
      let coveredDays = 0;

      for (const penalty of penaltiesForPeriod) {
        const coverageEndDate = this.addDaysUtc(dueDate, penalty.daysLate);
        if (coverageEndDate > asOfDate) {
          continue;
        }

        coveredDays = Math.max(coveredDays, penalty.daysLate);

        if (!penalty.wasCharged) {
          pendingPenalties.push({ ...penalty });
        }
      }

      const totalDaysLate = this.diffDays(dueDate, asOfDate);
      if (totalDaysLate <= coveredDays) {
        continue;
      }

      const incrementalDaysLate = totalDaysLate - coveredDays;
      const penaltyAmount = this.roundUpToNearestThousand(
        interest.interestAmount *
          this.monthlyInterestPenaltyMonthlyRate *
          (incrementalDaysLate / 30),
      );

      if (penaltyAmount <= AccrualProjectionService.MONEY_EPSILON) {
        continue;
      }

      pendingPenalties.push({
        id: `projected-penalty:${loanId}:${interest.id}:${totalDaysLate}`,
        loanId,
        installmentId: null,
        daysLate: totalDaysLate,
        penaltyAmount,
        wasCharged: false,
        periodStartDate: interest.periodStartDate,
        periodEndDate: interest.periodEndDate,
      });
    }

    return pendingPenalties.sort((left, right) => {
      const leftDate = left.periodEndDate?.getTime() ?? 0;
      const rightDate = right.periodEndDate?.getTime() ?? 0;

      return leftDate - rightDate;
    });
  }

  private resolveMonthlyPeriodsToCreate(
    startDate: Date,
    asOfDate: Date,
    existingPeriodKeys: Set<string>,
  ) {
    const periods: Array<{ periodStartDate: Date; periodEndDate: Date }> = [];
    let monthOffset = 0;

    while (true) {
      const currentPeriodStart = this.addMonthsClampedUtc(
        startDate,
        monthOffset,
      );

      if (currentPeriodStart >= asOfDate) {
        break;
      }

      const periodKey = this.toDateKey(currentPeriodStart);

      if (!existingPeriodKeys.has(periodKey)) {
        periods.push({
          periodStartDate: new Date(currentPeriodStart),
          periodEndDate: this.addMonthsClampedUtc(startDate, monthOffset + 1),
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

  private addDaysUtc(date: Date, days: number): Date {
    const normalizedDate = this.toUtcDateOnly(date);
    normalizedDate.setUTCDate(normalizedDate.getUTCDate() + days);

    return normalizedDate;
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

  private toDateKey(date: Date): string {
    return this.toUtcDateOnly(date).toISOString().split('T')[0];
  }

  private isSameUtcDate(left: Date, right: Date) {
    return this.toDateKey(left) === this.toDateKey(right);
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

  private normalizeMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}
