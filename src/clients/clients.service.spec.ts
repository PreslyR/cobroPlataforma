import {
  EarlySettlementInterestMode,
  LoanStatus,
  LoanType,
  PaymentFrequency,
} from '@prisma/client';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  const asOfDate = new Date('2026-05-20T00:00:00.000Z');

  let prisma: {
    client: {
      findMany: jest.Mock;
    };
  };
  let loansService: {
    getActiveLoanSnapshots: jest.Mock;
    getDebtBreakdown: jest.Mock;
  };
  let service: ClientsService;

  beforeEach(() => {
    prisma = {
      client: {
        findMany: jest.fn(),
      },
    };
    loansService = {
      getActiveLoanSnapshots: jest.fn(),
      getDebtBreakdown: jest.fn(),
    };
    service = new ClientsService(prisma as never, loansService as never);
  });

  it('builds the client portfolio from batched loan snapshots', async () => {
    loansService.getActiveLoanSnapshots.mockResolvedValue({
      asOfDate,
      snapshots: [
        makeSnapshot({
          loan: {
            id: 'loan-a-1',
            clientId: 'client-a',
            clientName: 'Ana Mora',
            principalAmount: 100000,
            currentPrincipal: 50000,
          },
          penalty: { pending: 5000, pendingCount: 1 },
          outstandingBalance: 50000,
          overdueAmount: 7000,
          totalCollectibleToday: 12000,
          overdue: true,
          oldestDueDate: new Date('2026-05-10T00:00:00.000Z'),
          daysLate: 10,
        }),
        makeSnapshot({
          loan: {
            id: 'loan-a-2',
            clientId: 'client-a',
            clientName: 'Ana Mora',
            principalAmount: 80000,
            currentPrincipal: 40000,
          },
          outstandingBalance: 40000,
          dueTodayAmount: 8000,
          totalCollectibleToday: 8000,
          dueToday: true,
          oldestDueDate: new Date('2026-05-20T00:00:00.000Z'),
        }),
        makeSnapshot({
          loan: {
            id: 'loan-b-1',
            clientId: 'client-b',
            clientName: 'Bruno Corriente',
            principalAmount: 50000,
            currentPrincipal: 50000,
          },
          outstandingBalance: 50000,
        }),
      ],
    });
    prisma.client.findMany.mockResolvedValue([
      {
        id: 'client-a',
        lenderId: 'lender-1',
        fullName: 'Ana Mora',
        documentNumber: '123',
        email: null,
        phone: '3001112222',
      },
      {
        id: 'client-b',
        lenderId: 'lender-1',
        fullName: 'Bruno Corriente',
        documentNumber: '456',
        email: 'bruno@example.com',
        phone: null,
      },
    ]);

    const result = await service.getPortfolio({
      lenderId: 'lender-1',
      asOf: '2026-05-20',
      search: ' Ana ',
    });

    expect(loansService.getActiveLoanSnapshots).toHaveBeenCalledWith({
      asOf: asOfDate,
      lenderId: 'lender-1',
      search: 'Ana',
      logLabel: 'clients.getPortfolio',
    });
    expect(loansService.getDebtBreakdown).not.toHaveBeenCalled();
    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['client-a', 'client-b'] },
        isActive: true,
        lenderId: 'lender-1',
      },
      select: {
        id: true,
        lenderId: true,
        fullName: true,
        documentNumber: true,
        email: true,
        phone: true,
      },
      orderBy: { fullName: 'asc' },
    });

    expect(result).toMatchObject({
      asOfDate,
      lenderId: 'lender-1',
      search: 'Ana',
      summary: {
        clientsWithActiveLoans: 2,
        clientsWithOverdueLoans: 1,
        totalCollectibleToday: 20000,
      },
      count: 2,
      items: [
        {
          clientId: 'client-a',
          activeLoansCount: 2,
          overdueLoansCount: 1,
          totalCollectibleToday: 20000,
          outstandingBalance: 90000,
          penaltyPending: 5000,
          dueTodayAmount: 8000,
          overdueAmount: 7000,
          daysLate: 10,
          operationalStatus: 'OVERDUE',
        },
        {
          clientId: 'client-b',
          activeLoansCount: 1,
          overdueLoansCount: 0,
          totalCollectibleToday: 0,
          outstandingBalance: 50000,
          penaltyPending: 0,
          dueTodayAmount: 0,
          overdueAmount: 0,
          daysLate: null,
          operationalStatus: 'CURRENT',
        },
      ],
    });
  });

  it('returns an empty portfolio without loading clients when there are no active snapshots', async () => {
    loansService.getActiveLoanSnapshots.mockResolvedValue({
      asOfDate,
      snapshots: [],
    });

    const result = await service.getPortfolio({ lenderId: 'lender-1' });

    expect(prisma.client.findMany).not.toHaveBeenCalled();
    expect(loansService.getDebtBreakdown).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      asOfDate,
      lenderId: 'lender-1',
      summary: {
        clientsWithActiveLoans: 0,
        clientsWithOverdueLoans: 0,
        totalCollectibleToday: 0,
      },
      count: 0,
      items: [],
    });
  });
});

function makeSnapshot(overrides: {
  loan?: Partial<{
    id: string;
    clientId: string;
    clientName: string;
    principalAmount: number;
    currentPrincipal: number;
  }>;
  penalty?: Partial<{
    pending: number;
    pendingCount: number;
    oldestPendingDueDate: Date | null;
  }>;
  outstandingBalance?: number;
  dueTodayAmount?: number;
  overdueAmount?: number;
  totalCollectibleToday?: number;
  dueToday?: boolean;
  overdue?: boolean;
  oldestDueDate?: Date | null;
  daysLate?: number;
}) {
  return {
    loan: {
      id: 'loan-1',
      lenderId: 'lender-1',
      clientId: 'client-1',
      clientName: 'Client Test',
      type: LoanType.MONTHLY_INTEREST,
      status: LoanStatus.ACTIVE,
      principalAmount: 100000,
      currentPrincipal: 100000,
      monthlyInterestRate: 0.1,
      installmentAmount: null,
      totalInstallments: null,
      paymentFrequency: PaymentFrequency.MONTHLY,
      earlySettlementInterestMode: EarlySettlementInterestMode.FULL_MONTH,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      expectedEndDate: null,
      ...overrides.loan,
    },
    penalty: {
      pending: 0,
      pendingCount: 0,
      oldestPendingDueDate: null,
      ...overrides.penalty,
    },
    interest: {
      totalGenerated: 0,
      totalPaid: 0,
      totalPending: 0,
      overduePending: 0,
      dueTodayPending: 0,
      currentPeriod: null,
    },
    installments: {
      totalPending: 0,
      dueTodayAmount: 0,
      overdueAmount: 0,
      dueTodayCount: 0,
      overdueCount: 0,
    },
    outstandingBalance: overrides.outstandingBalance ?? 0,
    dueTodayAmount: overrides.dueTodayAmount ?? 0,
    overdueAmount: overrides.overdueAmount ?? 0,
    totalCollectibleToday: overrides.totalCollectibleToday ?? 0,
    dueToday: overrides.dueToday ?? false,
    overdue: overrides.overdue ?? false,
    oldestDueDate: overrides.oldestDueDate ?? null,
    daysLate: overrides.daysLate ?? 0,
  };
}
