import { LoanStatus, LoanType } from '@prisma/client';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('builds the reports overview with one shared income aggregate', async () => {
    const prisma = {
      payment: {
        aggregate: jest.fn(async () => ({
          _sum: {
            totalAmount: 150000,
            appliedToInterest: 40000,
            appliedToPenalty: 10000,
          },
          _count: {
            id: 3,
          },
        })),
        count: jest.fn(),
        findMany: jest.fn(async () => [
          {
            id: 'payment-1',
            loanId: 'loan-1',
            clientId: 'client-1',
            totalAmount: 50000,
            appliedToInterest: 20000,
            appliedToPrincipal: 25000,
            appliedToPenalty: 5000,
            paymentDate: new Date('2026-05-20T00:00:00.000Z'),
            createdAt: new Date('2026-05-20T01:00:00.000Z'),
            isEarlySettlement: false,
            earlySettlementInterestModeUsed: null,
            interestDaysCharged: null,
            client: {
              fullName: 'Ana Cliente',
            },
            loan: {
              type: LoanType.MONTHLY_INTEREST,
              status: LoanStatus.ACTIVE,
            },
          },
        ]),
      },
      loan: {
        findMany: jest.fn(async () => []),
      },
    };
    const loansService = {
      getActiveLoanSnapshots: jest.fn(async () => ({
        asOfDate: new Date('2026-05-20T00:00:00.000Z'),
        snapshots: [],
      })),
    };
    const service = new ReportsService(prisma as never, loansService as never);

    const result = await service.getOverview(
      '2026-05-01',
      '2026-05-20',
      'lender-1',
      20,
    );

    expect(prisma.payment.aggregate).toHaveBeenCalledTimes(1);
    expect(prisma.payment.count).not.toHaveBeenCalled();
    expect(prisma.payment.findMany).toHaveBeenCalledTimes(1);
    expect(loansService.getActiveLoanSnapshots).toHaveBeenCalledWith({
      asOf: new Date('2026-05-20T00:00:00.000Z'),
      lenderId: 'lender-1',
      logLabel: 'reports.getPortfolioSummary',
    });
    expect(result).toMatchObject({
      interestIncome: {
        paymentsCount: 3,
        totalCollectedAmount: 150000,
        totalInterestIncome: 40000,
      },
      penaltyIncome: {
        paymentsCount: 3,
        totalCollectedAmount: 150000,
        totalPenaltyIncome: 10000,
      },
      paymentsHistory: {
        totalCount: 3,
        items: [
          {
            id: 'payment-1',
            clientName: 'Ana Cliente',
            loanType: LoanType.MONTHLY_INTEREST,
          },
        ],
      },
      closedLoans: {
        totalCount: 0,
        items: [],
      },
    });
  });
});
