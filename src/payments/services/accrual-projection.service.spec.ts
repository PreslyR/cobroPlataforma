import { InstallmentStatus, LoanStatus, LoanType } from '@prisma/client';
import { AccrualProjectionService } from './accrual-projection.service';

describe('AccrualProjectionService', () => {
  const service = new AccrualProjectionService();

  it('projects fixed-installment penalty without persisted writes', () => {
    const projection = service.projectLoanAccruals({
      loan: {
        id: 'loan-fixed',
        type: LoanType.FIXED_INSTALLMENTS,
        status: LoanStatus.ACTIVE,
        principalAmount: 100000,
        monthlyInterestRate: null,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
      },
      asOfDate: new Date('2026-04-11T00:00:00.000Z'),
      interests: [],
      penalties: [],
      payments: [],
      installments: [
        {
          id: 'inst-1',
          dueDate: new Date('2026-04-04T00:00:00.000Z'),
          amount: 30000,
          status: InstallmentStatus.PENDING,
        },
      ],
    });

    expect(projection.pendingPenalties).toEqual([
      expect.objectContaining({
        id: 'projected-penalty:loan-fixed:inst-1:2026-04-11',
        installmentId: 'inst-1',
        daysLate: 7,
        penaltyAmount: 2000,
        wasCharged: false,
      }),
    ]);
  });

  it('projects missing monthly-interest periods and overdue penalty in memory', () => {
    const projection = service.projectLoanAccruals({
      loan: {
        id: 'loan-monthly',
        type: LoanType.MONTHLY_INTEREST,
        status: LoanStatus.ACTIVE,
        principalAmount: 200000,
        monthlyInterestRate: 0.1,
        startDate: new Date('2026-03-01T00:00:00.000Z'),
      },
      asOfDate: new Date('2026-05-02T00:00:00.000Z'),
      interests: [],
      penalties: [],
      payments: [],
      installments: [],
    });

    expect(projection.interests).toHaveLength(3);
    expect(projection.interests.map((interest) => interest.interestPending)).toEqual([
      20000,
      20000,
      20000,
    ]);
    expect(projection.pendingPenalties).toEqual([
      expect.objectContaining({
        installmentId: null,
        daysLate: 31,
        penaltyAmount: 5000,
        wasCharged: false,
      }),
      expect.objectContaining({
        installmentId: null,
        daysLate: 1,
        penaltyAmount: 1000,
        wasCharged: false,
      }),
    ]);
  });
});
