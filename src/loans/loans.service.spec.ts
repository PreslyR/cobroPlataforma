import {
  EarlySettlementInterestMode,
  InstallmentStatus,
  LoanStatus,
  LoanType,
  PaymentFrequency,
} from "@prisma/client";
import { LoansService } from "./loans.service";

describe("LoansService", () => {
  let service: LoansService;
  let prisma: {
    loan: { create: jest.Mock };
    installment: { createMany: jest.Mock };
    loanInterest: { createMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      loan: {
        create: jest.fn(async ({ data }) => ({
          id: "loan-1",
          ...data,
          lender: { id: data.lenderId, name: "Lender Test" },
          client: {
            id: data.clientId,
            fullName: "Cliente Test",
            documentNumber: "123456789",
          },
        })),
      },
      installment: {
        createMany: jest.fn(async () => ({ count: 1 })),
      },
      loanInterest: {
        createMany: jest.fn(async () => ({ count: 1 })),
      },
    };

    service = new LoansService(prisma as never, {} as never, {} as never);
  });

  it("calculates expectedEndDate for fixed installments using the installment schedule", async () => {
    await service.create({
      lenderId: "lender-1",
      clientId: "client-1",
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 1000,
      installmentAmount: 400,
      totalInstallments: 3,
      paymentFrequency: PaymentFrequency.WEEKLY,
      startDate: "2026-04-05",
      expectedEndDate: "2030-01-01",
    });

    const createArgs = prisma.loan.create.mock.calls[0][0];

    expect(createArgs.data.startDate.toISOString()).toBe(
      "2026-04-05T00:00:00.000Z",
    );
    expect(createArgs.data.expectedEndDate.toISOString()).toBe(
      "2026-04-26T00:00:00.000Z",
    );
  });

  it("creates exact weekly due dates for fixed installments with rounded peso amounts", async () => {
    await service.create({
      lenderId: "lender-1",
      clientId: "client-1",
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 100000,
      installmentAmount: 30000,
      totalInstallments: 4,
      paymentFrequency: PaymentFrequency.WEEKLY,
      startDate: "2026-03-24",
    });

    const createManyArgs = prisma.installment.createMany.mock.calls[0][0];

    expect(createManyArgs.data).toEqual([
      expect.objectContaining({
        installmentNumber: 1,
        amount: 30000,
        dueDate: new Date("2026-03-31T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 2,
        amount: 30000,
        dueDate: new Date("2026-04-07T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 3,
        amount: 30000,
        dueDate: new Date("2026-04-14T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 4,
        amount: 30000,
        dueDate: new Date("2026-04-21T00:00:00.000Z"),
      }),
    ]);
  });

  it("creates exact biweekly due dates for fixed installments with rounded peso amounts", async () => {
    await service.create({
      lenderId: "lender-1",
      clientId: "client-1",
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 100000,
      installmentAmount: 30000,
      totalInstallments: 4,
      paymentFrequency: PaymentFrequency.BIWEEKLY,
      startDate: "2026-03-24",
    });

    const createManyArgs = prisma.installment.createMany.mock.calls[0][0];

    expect(createManyArgs.data).toEqual([
      expect.objectContaining({
        installmentNumber: 1,
        amount: 30000,
        dueDate: new Date("2026-04-07T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 2,
        amount: 30000,
        dueDate: new Date("2026-04-21T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 3,
        amount: 30000,
        dueDate: new Date("2026-05-05T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 4,
        amount: 30000,
        dueDate: new Date("2026-05-19T00:00:00.000Z"),
      }),
    ]);
  });

  it("clamps monthly fixed-installment due dates to the last valid day of the target month", async () => {
    await service.create({
      lenderId: "lender-1",
      clientId: "client-1",
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 1000,
      installmentAmount: 1000,
      totalInstallments: 1,
      paymentFrequency: PaymentFrequency.MONTHLY,
      startDate: "2026-01-31",
    });

    const createArgs = prisma.loan.create.mock.calls[0][0];

    expect(createArgs.data.expectedEndDate.toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
  });

  it("creates exact monthly due dates for fixed installments with rounded peso amounts", async () => {
    await service.create({
      lenderId: "lender-1",
      clientId: "client-1",
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 100000,
      installmentAmount: 30000,
      totalInstallments: 4,
      paymentFrequency: PaymentFrequency.MONTHLY,
      startDate: "2026-01-31",
    });

    const createManyArgs = prisma.installment.createMany.mock.calls[0][0];

    expect(createManyArgs.data).toEqual([
      expect.objectContaining({
        installmentNumber: 1,
        amount: 30000,
        dueDate: new Date("2026-02-28T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 2,
        amount: 30000,
        dueDate: new Date("2026-03-31T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 3,
        amount: 30000,
        dueDate: new Date("2026-04-30T00:00:00.000Z"),
      }),
      expect.objectContaining({
        installmentNumber: 4,
        amount: 30000,
        dueDate: new Date("2026-05-31T00:00:00.000Z"),
      }),
    ]);
  });

  it("keeps client-provided expectedEndDate for non-fixed loans", async () => {
    await service.create({
      lenderId: "lender-1",
      clientId: "client-1",
      type: LoanType.MONTHLY_INTEREST,
      principalAmount: 1000,
      monthlyInterestRate: 0.05,
      paymentFrequency: PaymentFrequency.MONTHLY,
      startDate: "2026-04-05",
      expectedEndDate: "2026-12-05",
    });

    const createArgs = prisma.loan.create.mock.calls[0][0];

    expect(createArgs.data.expectedEndDate.toISOString()).toBe(
      "2026-12-05T00:00:00.000Z",
    );
  });

  it("builds active loan snapshots from batched read queries", async () => {
    const snapshotPrisma = {
      loan: {
        findMany: jest.fn(async () => [
          {
            id: "loan-fixed",
            lenderId: "lender-1",
            clientId: "client-1",
            type: LoanType.FIXED_INSTALLMENTS,
            status: LoanStatus.ACTIVE,
            principalAmount: 100000,
            currentPrincipal: 100000,
            monthlyInterestRate: null,
            installmentAmount: 30000,
            totalInstallments: 4,
            paymentFrequency: PaymentFrequency.WEEKLY,
            earlySettlementInterestMode: EarlySettlementInterestMode.FULL_MONTH,
            startDate: new Date("2026-04-10T00:00:00.000Z"),
            expectedEndDate: new Date("2026-05-08T00:00:00.000Z"),
            client: {
              fullName: "Ana Fixed",
            },
          },
          {
            id: "loan-monthly",
            lenderId: "lender-1",
            clientId: "client-2",
            type: LoanType.MONTHLY_INTEREST,
            status: LoanStatus.ACTIVE,
            principalAmount: 200000,
            currentPrincipal: 200000,
            monthlyInterestRate: 0.1,
            installmentAmount: null,
            totalInstallments: null,
            paymentFrequency: PaymentFrequency.MONTHLY,
            earlySettlementInterestMode: EarlySettlementInterestMode.FULL_MONTH,
            startDate: new Date("2026-03-01T00:00:00.000Z"),
            expectedEndDate: null,
            client: {
              fullName: "Bruno Monthly",
            },
          },
        ]),
      },
      loanPenalty: {
        findMany: jest.fn(async () => [
          {
            id: "penalty-1",
            loanId: "loan-monthly",
            penaltyAmount: 5000,
            periodEndDate: new Date("2026-05-01T00:00:00.000Z"),
          },
        ]),
      },
      loanInterest: {
        findMany: jest.fn(async () => [
          {
            id: "interest-fixed-1",
            loanId: "loan-fixed",
            periodStartDate: new Date("2026-04-10T00:00:00.000Z"),
            periodEndDate: new Date("2026-04-17T00:00:00.000Z"),
            interestAmount: 5000,
            interestPaid: 5000,
            interestPending: 0,
          },
          {
            id: "interest-fixed-2",
            loanId: "loan-fixed",
            periodStartDate: new Date("2026-04-17T00:00:00.000Z"),
            periodEndDate: new Date("2026-04-24T00:00:00.000Z"),
            interestAmount: 5000,
            interestPaid: 0,
            interestPending: 5000,
          },
          {
            id: "interest-monthly-1",
            loanId: "loan-monthly",
            periodStartDate: new Date("2026-04-01T00:00:00.000Z"),
            periodEndDate: new Date("2026-05-01T00:00:00.000Z"),
            interestAmount: 20000,
            interestPaid: 0,
            interestPending: 20000,
          },
        ]),
      },
      installment: {
        findMany: jest.fn(async () => [
          {
            id: "inst-1",
            loanId: "loan-fixed",
            installmentNumber: 1,
            dueDate: new Date("2026-04-17T00:00:00.000Z"),
            amount: 30000,
            status: InstallmentStatus.PAID,
          },
          {
            id: "inst-2",
            loanId: "loan-fixed",
            installmentNumber: 2,
            dueDate: new Date("2026-04-24T00:00:00.000Z"),
            amount: 30000,
            status: InstallmentStatus.PENDING,
          },
          {
            id: "inst-3",
            loanId: "loan-fixed",
            installmentNumber: 3,
            dueDate: new Date("2026-05-02T00:00:00.000Z"),
            amount: 30000,
            status: InstallmentStatus.PENDING,
          },
          {
            id: "inst-4",
            loanId: "loan-fixed",
            installmentNumber: 4,
            dueDate: new Date("2026-05-09T00:00:00.000Z"),
            amount: 30000,
            status: InstallmentStatus.PENDING,
          },
        ]),
      },
      payment: {
        groupBy: jest.fn(async () => [
          {
            loanId: "loan-fixed",
            _sum: {
              appliedToPrincipal: 25000,
              appliedToInterest: 5000,
            },
          },
        ]),
      },
    };
    const interestService = {
      ensureMonthlyInterestScheduleUpTo: jest.fn(async () => 0),
    };
    const penaltyService = {
      generateFixedInstallmentPenaltiesIncremental: jest.fn(async () => []),
      generateMonthlyInterestPenaltiesIncremental: jest.fn(async () => []),
    };
    const snapshotService = new LoansService(
      snapshotPrisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await snapshotService.getActiveLoanSnapshots({
      asOf: "2026-05-02",
      lenderId: "lender-1",
    });

    expect(snapshotPrisma.loan.findMany).toHaveBeenCalledTimes(1);
    expect(snapshotPrisma.loanPenalty.findMany).toHaveBeenCalledTimes(1);
    expect(snapshotPrisma.loanInterest.findMany).toHaveBeenCalledTimes(1);
    expect(snapshotPrisma.installment.findMany).toHaveBeenCalledTimes(1);
    expect(snapshotPrisma.payment.groupBy).toHaveBeenCalledTimes(1);

    expect(interestService.ensureMonthlyInterestScheduleUpTo).toHaveBeenCalledWith(
      "loan-monthly",
      new Date("2026-05-02T00:00:00.000Z"),
    );
    expect(
      penaltyService.generateFixedInstallmentPenaltiesIncremental,
    ).toHaveBeenCalledWith("loan-fixed", new Date("2026-05-02T00:00:00.000Z"), {
      preserveFutureState: false,
    });

    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0]).toMatchObject({
      loan: {
        id: "loan-fixed",
        clientName: "Ana Fixed",
        currentPrincipal: 75000,
      },
      dueToday: true,
      overdue: true,
      dueTodayAmount: 30000,
      overdueAmount: 30000,
      totalCollectibleToday: 60000,
      installments: {
        totalPending: 90000,
        dueTodayCount: 1,
        overdueCount: 1,
      },
    });
    expect(result.snapshots[1]).toMatchObject({
      loan: {
        id: "loan-monthly",
        clientName: "Bruno Monthly",
        currentPrincipal: 200000,
      },
      dueToday: false,
      overdue: true,
      dueTodayAmount: 0,
      overdueAmount: 20000,
      totalCollectibleToday: 25000,
      penalty: {
        pending: 5000,
      },
      interest: {
        totalPending: 20000,
        overduePending: 20000,
      },
    });
  });
});
