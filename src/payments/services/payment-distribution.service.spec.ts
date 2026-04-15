import { EarlySettlementInterestMode, LoanStatus, LoanType } from "@prisma/client";
import { PaymentDistributionService } from "./payment-distribution.service";

function buildWeeklyLoan() {
  return {
    id: "loan-weekly",
    type: LoanType.FIXED_INSTALLMENTS,
    status: LoanStatus.ACTIVE,
    principalAmount: 100000,
    currentPrincipal: 100000,
    installmentAmount: 30000,
    totalInstallments: 4,
    startDate: new Date("2026-03-24T00:00:00.000Z"),
    earlySettlementInterestMode: null,
  };
}

function buildBiweeklyLoan() {
  return {
    id: "loan-biweekly",
    type: LoanType.FIXED_INSTALLMENTS,
    status: LoanStatus.ACTIVE,
    principalAmount: 100000,
    currentPrincipal: 100000,
    installmentAmount: 30000,
    totalInstallments: 4,
    startDate: new Date("2026-03-24T00:00:00.000Z"),
    earlySettlementInterestMode: null,
  };
}

function buildMonthlyLoan() {
  return {
    id: "loan-monthly",
    type: LoanType.FIXED_INSTALLMENTS,
    status: LoanStatus.ACTIVE,
    principalAmount: 100000,
    currentPrincipal: 100000,
    installmentAmount: 30000,
    totalInstallments: 4,
    startDate: new Date("2026-01-31T00:00:00.000Z"),
    earlySettlementInterestMode: null,
  };
}

function buildMonthlyInterestLoan() {
  return {
    id: "loan-monthly-interest",
    type: LoanType.MONTHLY_INTEREST,
    status: LoanStatus.ACTIVE,
    principalAmount: 400000,
    currentPrincipal: 400000,
    installmentAmount: null,
    totalInstallments: null,
    startDate: new Date("2026-03-12T00:00:00.000Z"),
    earlySettlementInterestMode: null,
  };
}

describe("PaymentDistributionService - weekly fixed installments", () => {
  it("simulates a weekly partial payment with clean split between interest and capital", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => buildWeeklyLoan()),
      },
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          }),
      },
      installment: {
        findMany: jest.fn(async () => [
          { amount: 30000 },
          { amount: 30000 },
          { amount: 30000 },
          { amount: 30000 },
        ]),
      },
      loanInterest: {
        findMany: jest.fn(async () => [
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
        ]),
      },
    };

    const interestService = {};
    const penaltyService = {
      generateFixedInstallmentPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.simulatePayment(
      "loan-weekly",
      15000,
      new Date("2026-03-31T00:00:00.000Z"),
    );

    expect(result.distribution).toEqual({
      totalAmount: 15000,
      appliedToPenalty: 0,
      appliedToInterest: 5000,
      appliedToPrincipal: 10000,
      remaining: 0,
    });
    expect(result.wouldCloseLoan).toBe(false);
  });

  it("closes a weekly fixed-installment loan with exact rounded totals", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => buildWeeklyLoan()),
        update: jest.fn(async ({ data }) => ({ id: "loan-weekly", ...data })),
      },
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 100000, appliedToInterest: 20000 },
          }),
        create: jest.fn(async ({ data }) => ({
          ...data,
          loan: {
            id: "loan-weekly",
            currentPrincipal: 0,
            status: LoanStatus.PAID,
          },
          client: {
            id: "client-1",
            fullName: "Cliente semanal",
          },
        })),
      },
      installment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { amount: 30000 },
            { amount: 30000 },
            { amount: 30000 },
            { amount: 30000 },
          ])
          .mockResolvedValueOnce([
            { id: "inst-1", amount: 30000, status: "PENDING" },
            { id: "inst-2", amount: 30000, status: "PENDING" },
            { id: "inst-3", amount: 30000, status: "PENDING" },
            { id: "inst-4", amount: 30000, status: "PENDING" },
          ]),
        update: jest.fn(async () => ({})),
      },
      loanInterest: {
        count: jest.fn(async () => 4),
        findMany: jest.fn(async () => [
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
        ]),
      },
    };

    const interestService = {
      applyPaymentToInterest: jest.fn(async (_loanId: string, amount: number) => ({
        applied: amount,
        remaining: 0,
      })),
    };
    const penaltyService = {
      generateFixedInstallmentPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
      applyPaymentToPenalty: jest.fn(async (_loanId: string, amount: number) => ({
        applied: 0,
        remaining: amount,
        penaltiesCharged: [],
      })),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.processPayment(
      "loan-weekly",
      "client-1",
      120000,
      new Date("2026-04-21T00:00:00.000Z"),
    );

    expect(result.distribution).toEqual({
      totalAmount: 120000,
      appliedToPenalty: 0,
      appliedToInterest: 20000,
      appliedToPrincipal: 100000,
      remaining: 0,
    });
    expect(result.loanStatus.isPaid).toBe(true);
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-weekly" },
      data: {
        currentPrincipal: 0,
        status: LoanStatus.PAID,
      },
    });
    expect(prisma.installment.update).toHaveBeenCalledTimes(4);
  });
});

describe("PaymentDistributionService - biweekly fixed installments", () => {
  it("simulates a biweekly partial payment with clean split between interest and capital", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => buildBiweeklyLoan()),
      },
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          }),
      },
      installment: {
        findMany: jest.fn(async () => [
          { amount: 30000 },
          { amount: 30000 },
          { amount: 30000 },
          { amount: 30000 },
        ]),
      },
      loanInterest: {
        findMany: jest.fn(async () => [
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
        ]),
      },
    };

    const interestService = {};
    const penaltyService = {
      generateFixedInstallmentPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.simulatePayment(
      "loan-biweekly",
      15000,
      new Date("2026-04-07T00:00:00.000Z"),
    );

    expect(result.distribution).toEqual({
      totalAmount: 15000,
      appliedToPenalty: 0,
      appliedToInterest: 5000,
      appliedToPrincipal: 10000,
      remaining: 0,
    });
    expect(result.wouldCloseLoan).toBe(false);
  });

  it("closes a biweekly fixed-installment loan with exact rounded totals", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => buildBiweeklyLoan()),
        update: jest.fn(async ({ data }) => ({ id: "loan-biweekly", ...data })),
      },
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 100000, appliedToInterest: 20000 },
          }),
        create: jest.fn(async ({ data }) => ({
          ...data,
          loan: {
            id: "loan-biweekly",
            currentPrincipal: 0,
            status: LoanStatus.PAID,
          },
          client: {
            id: "client-1",
            fullName: "Cliente quincenal",
          },
        })),
      },
      installment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { amount: 30000 },
            { amount: 30000 },
            { amount: 30000 },
            { amount: 30000 },
          ])
          .mockResolvedValueOnce([
            { id: "inst-1", amount: 30000, status: "PENDING" },
            { id: "inst-2", amount: 30000, status: "PENDING" },
            { id: "inst-3", amount: 30000, status: "PENDING" },
            { id: "inst-4", amount: 30000, status: "PENDING" },
          ]),
        update: jest.fn(async () => ({})),
      },
      loanInterest: {
        count: jest.fn(async () => 4),
        findMany: jest.fn(async () => [
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
        ]),
      },
    };

    const interestService = {
      applyPaymentToInterest: jest.fn(async (_loanId: string, amount: number) => ({
        applied: amount,
        remaining: 0,
      })),
    };
    const penaltyService = {
      generateFixedInstallmentPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
      applyPaymentToPenalty: jest.fn(async (_loanId: string, amount: number) => ({
        applied: 0,
        remaining: amount,
        penaltiesCharged: [],
      })),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.processPayment(
      "loan-biweekly",
      "client-1",
      120000,
      new Date("2026-05-19T00:00:00.000Z"),
    );

    expect(result.distribution).toEqual({
      totalAmount: 120000,
      appliedToPenalty: 0,
      appliedToInterest: 20000,
      appliedToPrincipal: 100000,
      remaining: 0,
    });
    expect(result.loanStatus.isPaid).toBe(true);
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-biweekly" },
      data: {
        currentPrincipal: 0,
        status: LoanStatus.PAID,
      },
    });
    expect(prisma.installment.update).toHaveBeenCalledTimes(4);
  });
});


describe("PaymentDistributionService - monthly fixed installments", () => {
  it("simulates a monthly partial payment with clean split between interest and capital", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => buildMonthlyLoan()),
      },
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          }),
      },
      installment: {
        findMany: jest.fn(async () => [
          { amount: 30000 },
          { amount: 30000 },
          { amount: 30000 },
          { amount: 30000 },
        ]),
      },
      loanInterest: {
        findMany: jest.fn(async () => [
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
        ]),
      },
    };

    const interestService = {};
    const penaltyService = {
      generateFixedInstallmentPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.simulatePayment(
      "loan-monthly",
      15000,
      new Date("2026-02-28T00:00:00.000Z"),
    );

    expect(result.distribution).toEqual({
      totalAmount: 15000,
      appliedToPenalty: 0,
      appliedToInterest: 5000,
      appliedToPrincipal: 10000,
      remaining: 0,
    });
    expect(result.wouldCloseLoan).toBe(false);
  });

  it("closes a monthly fixed-installment loan with exact rounded totals", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => buildMonthlyLoan()),
        update: jest.fn(async ({ data }) => ({ id: "loan-monthly", ...data })),
      },
      payment: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 0, appliedToInterest: 0 },
          })
          .mockResolvedValueOnce({
            _sum: { appliedToPrincipal: 100000, appliedToInterest: 20000 },
          }),
        create: jest.fn(async ({ data }) => ({
          ...data,
          loan: {
            id: "loan-monthly",
            currentPrincipal: 0,
            status: LoanStatus.PAID,
          },
          client: {
            id: "client-1",
            fullName: "Cliente mensual",
          },
        })),
      },
      installment: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            { amount: 30000 },
            { amount: 30000 },
            { amount: 30000 },
            { amount: 30000 },
          ])
          .mockResolvedValueOnce([
            { id: "inst-1", amount: 30000, status: "PENDING" },
            { id: "inst-2", amount: 30000, status: "PENDING" },
            { id: "inst-3", amount: 30000, status: "PENDING" },
            { id: "inst-4", amount: 30000, status: "PENDING" },
          ]),
        update: jest.fn(async () => ({})),
      },
      loanInterest: {
        count: jest.fn(async () => 4),
        findMany: jest.fn(async () => [
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
          { interestPending: 5000 },
        ]),
      },
    };

    const interestService = {
      applyPaymentToInterest: jest.fn(async (_loanId: string, amount: number) => ({
        applied: amount,
        remaining: 0,
      })),
    };
    const penaltyService = {
      generateFixedInstallmentPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
      applyPaymentToPenalty: jest.fn(async (_loanId: string, amount: number) => ({
        applied: 0,
        remaining: amount,
        penaltiesCharged: [],
      })),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.processPayment(
      "loan-monthly",
      "client-1",
      120000,
      new Date("2026-05-31T00:00:00.000Z"),
    );

    expect(result.distribution).toEqual({
      totalAmount: 120000,
      appliedToPenalty: 0,
      appliedToInterest: 20000,
      appliedToPrincipal: 100000,
      remaining: 0,
    });
    expect(result.loanStatus.isPaid).toBe(true);
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-monthly" },
      data: {
        currentPrincipal: 0,
        status: LoanStatus.PAID,
      },
    });
    expect(prisma.installment.update).toHaveBeenCalledTimes(4);
  });
});

describe("PaymentDistributionService - monthly interest", () => {
  it("keeps a monthly-interest loan active after a regular partial payment", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => buildMonthlyInterestLoan()),
        update: jest.fn(async ({ data }) => ({
          id: "loan-monthly-interest",
          ...data,
        })),
      },
      payment: {
        create: jest.fn(async ({ data }) => ({
          ...data,
          loan: {
            id: "loan-monthly-interest",
            currentPrincipal: 340000,
            status: LoanStatus.ACTIVE,
          },
          client: {
            id: "client-1",
            fullName: "Cliente interes mensual",
          },
        })),
      },
    };

    const interestService = {
      ensureMonthlyInterestScheduleUpTo: jest.fn(async () => 0),
      getTotalPendingInterest: jest.fn(async () => 80000),
      applyPaymentToInterest: jest.fn(async () => ({
        applied: 80000,
        remaining: 60000,
      })),
    };
    const penaltyService = {
      generateMonthlyInterestPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 10000),
      applyPaymentToPenalty: jest.fn(async () => ({
        applied: 10000,
        remaining: 140000,
        penaltiesCharged: [],
      })),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.processPayment(
      "loan-monthly-interest",
      "client-1",
      150000,
      new Date("2026-04-11T00:00:00.000Z"),
    );

    expect(result.distribution).toEqual({
      totalAmount: 150000,
      appliedToPenalty: 10000,
      appliedToInterest: 80000,
      appliedToPrincipal: 60000,
      remaining: 0,
    });
    expect(result.loanStatus).toEqual({
      currentPrincipal: 340000,
      isPaid: false,
    });
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-monthly-interest" },
      data: {
        currentPrincipal: 340000,
        status: LoanStatus.ACTIVE,
      },
    });
  });

  it("closes a monthly-interest loan after a regular payment that clears pending interest and capital", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => buildMonthlyInterestLoan()),
        update: jest.fn(async ({ data }) => ({
          id: "loan-monthly-interest",
          ...data,
        })),
      },
      payment: {
        create: jest.fn(async ({ data }) => ({
          ...data,
          loan: {
            id: "loan-monthly-interest",
            currentPrincipal: 0,
            status: LoanStatus.PAID,
          },
          client: {
            id: "client-1",
            fullName: "Cliente interes mensual",
          },
        })),
      },
    };

    const interestService = {
      ensureMonthlyInterestScheduleUpTo: jest.fn(async () => 0),
      getTotalPendingInterest: jest.fn(async () => 80000),
      applyPaymentToInterest: jest.fn(async () => ({
        applied: 80000,
        remaining: 400000,
      })),
    };
    const penaltyService = {
      generateMonthlyInterestPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
      applyPaymentToPenalty: jest.fn(async (_loanId: string, amount: number) => ({
        applied: 0,
        remaining: amount,
        penaltiesCharged: [],
      })),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.processPayment(
      "loan-monthly-interest",
      "client-1",
      480000,
      new Date("2026-04-11T00:00:00.000Z"),
    );

    expect(result.distribution).toEqual({
      totalAmount: 480000,
      appliedToPenalty: 0,
      appliedToInterest: 80000,
      appliedToPrincipal: 400000,
      remaining: 0,
    });
    expect(result.loanStatus.isPaid).toBe(true);
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-monthly-interest" },
      data: {
        currentPrincipal: 0,
        status: LoanStatus.PAID,
      },
    });
  });

  it("closes a monthly-interest loan after an early-settlement payment with full-month interest and pending penalty", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => ({
          ...buildMonthlyInterestLoan(),
          earlySettlementInterestMode: EarlySettlementInterestMode.FULL_MONTH,
        })),
        update: jest.fn(async ({ data }) => ({
          id: "loan-monthly-interest",
          ...data,
        })),
      },
      loanPenalty: {
        findMany: jest.fn(async () => [
          {
            id: "penalty-1",
            penaltyAmount: 10000,
            wasCharged: false,
            calculatedAt: new Date("2026-04-10T00:00:00.000Z"),
          },
        ]),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      loanInterest: {
        findMany: jest.fn(async () => [
          {
            id: "interest-1",
            periodStartDate: new Date("2026-04-01T00:00:00.000Z"),
            periodEndDate: new Date("2026-05-01T00:00:00.000Z"),
            interestAmount: 80000,
            interestPaid: 0,
            interestPending: 80000,
          },
        ]),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      payment: {
        create: jest.fn(async ({ data }) => ({
          ...data,
          loan: {
            id: "loan-monthly-interest",
            currentPrincipal: 0,
            status: LoanStatus.PAID,
          },
          client: {
            id: "client-1",
            fullName: "Cliente interes mensual",
          },
        })),
      },
    };

    const interestService = {
      ensureMonthlyInterestScheduleUpTo: jest.fn(async () => 0),
      applyPaymentToInterest: jest.fn(async (_loanId: string, amount: number) => ({
        applied: amount,
        remaining: 0,
      })),
    };
    const penaltyService = {
      generateMonthlyInterestPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 10000),
      applyPaymentToPenalty: jest.fn(async (_loanId: string, amount: number) => ({
        applied: 10000,
        remaining: amount - 10000,
        penaltiesCharged: [],
      })),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.processPayment(
      "loan-monthly-interest",
      "client-1",
      490000,
      new Date("2026-04-11T00:00:00.000Z"),
      {
        isEarlySettlement: true,
      },
    );

    expect(result.distribution).toEqual({
      totalAmount: 490000,
      appliedToPenalty: 10000,
      appliedToInterest: 80000,
      appliedToPrincipal: 400000,
      remaining: 0,
    });
    expect(result.payment.isEarlySettlement).toBe(true);
    expect(result.payment.earlySettlementInterestModeUsed).toBe(
      EarlySettlementInterestMode.FULL_MONTH,
    );
    expect(result.payment.interestDaysCharged).toBeNull();
    expect(result.loanStatus.isPaid).toBe(true);
  });

  it("closes a monthly-interest loan after an early-settlement payment", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => ({
          ...buildMonthlyInterestLoan(),
          earlySettlementInterestMode: null,
        })),
        update: jest.fn(async ({ data }) => ({
          id: "loan-monthly-interest",
          ...data,
        })),
      },
      loanPenalty: {
        findMany: jest.fn(async () => []),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      loanInterest: {
        findMany: jest.fn(async () => [
          {
            id: "interest-1",
            periodStartDate: new Date("2026-04-01T00:00:00.000Z"),
            periodEndDate: new Date("2026-05-01T00:00:00.000Z"),
            interestAmount: 80000,
            interestPaid: 0,
            interestPending: 80000,
          },
        ]),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      payment: {
        create: jest.fn(async ({ data }) => ({
          ...data,
          loan: {
            id: "loan-monthly-interest",
            currentPrincipal: 0,
            status: LoanStatus.PAID,
          },
          client: {
            id: "client-1",
            fullName: "Cliente interes mensual",
          },
        })),
      },
    };

    const interestService = {
      ensureMonthlyInterestScheduleUpTo: jest.fn(async () => 0),
      applyPaymentToInterest: jest.fn(async (_loanId: string, amount: number) => ({
        applied: amount,
        remaining: 0,
      })),
    };
    const penaltyService = {
      generateMonthlyInterestPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
      applyPaymentToPenalty: jest.fn(async (_loanId: string, amount: number) => ({
        applied: 0,
        remaining: amount,
        penaltiesCharged: [],
      })),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.processPayment(
      "loan-monthly-interest",
      "client-1",
      480000,
      new Date("2026-04-11T00:00:00.000Z"),
      {
        isEarlySettlement: true,
      },
    );

    expect(result.distribution).toEqual({
      totalAmount: 480000,
      appliedToPenalty: 0,
      appliedToInterest: 80000,
      appliedToPrincipal: 400000,
      remaining: 0,
    });
    expect(result.loanStatus.isPaid).toBe(true);
    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-monthly-interest" },
      data: {
        currentPrincipal: 0,
        status: LoanStatus.PAID,
      },
    });
  });

  it("closes a monthly-interest loan after a prorated early-settlement payment", async () => {
    const paymentDate = new Date("2026-04-11T00:00:00.000Z");
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => ({
          ...buildMonthlyInterestLoan(),
          earlySettlementInterestMode: EarlySettlementInterestMode.PRORATED_BY_DAYS,
        })),
        update: jest.fn(async ({ data }) => ({
          id: "loan-monthly-interest",
          ...data,
        })),
      },
      loanPenalty: {
        findMany: jest.fn(async () => []),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      loanInterest: {
        findMany: jest.fn(async () => [
          {
            id: "interest-1",
            periodStartDate: new Date("2026-04-01T00:00:00.000Z"),
            periodEndDate: new Date("2026-05-01T00:00:00.000Z"),
            interestAmount: 80000,
            interestPaid: 0,
            interestPending: 80000,
          },
        ]),
        update: jest.fn(async ({ data }) => ({
          id: "interest-1",
          ...data,
        })),
        deleteMany: jest.fn(async () => ({ count: 0 })),
      },
      payment: {
        create: jest.fn(async ({ data }) => ({
          ...data,
          loan: {
            id: "loan-monthly-interest",
            currentPrincipal: 0,
            status: LoanStatus.PAID,
          },
          client: {
            id: "client-1",
            fullName: "Cliente interes mensual",
          },
        })),
      },
    };

    const interestService = {
      ensureMonthlyInterestScheduleUpTo: jest.fn(async () => 0),
      applyPaymentToInterest: jest.fn(async (_loanId: string, amount: number) => ({
        applied: amount,
        remaining: 0,
      })),
    };
    const penaltyService = {
      generateMonthlyInterestPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
      applyPaymentToPenalty: jest.fn(async (_loanId: string, amount: number) => ({
        applied: 0,
        remaining: amount,
        penaltiesCharged: [],
      })),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    const result = await service.processPayment(
      "loan-monthly-interest",
      "client-1",
      430000,
      paymentDate,
      {
        isEarlySettlement: true,
        earlySettlementInterestModeOverride: EarlySettlementInterestMode.PRORATED_BY_DAYS,
      },
    );

    expect(prisma.loanInterest.update).toHaveBeenCalledWith({
      where: { id: "interest-1" },
      data: {
        interestAmount: 30000,
        interestPending: 30000,
        periodEndDate: paymentDate,
      },
    });
    expect(result.distribution).toEqual({
      totalAmount: 430000,
      appliedToPenalty: 0,
      appliedToInterest: 30000,
      appliedToPrincipal: 400000,
      remaining: 0,
    });
    expect(result.payment.earlySettlementInterestModeUsed).toBe(
      EarlySettlementInterestMode.PRORATED_BY_DAYS,
    );
    expect(result.payment.interestDaysCharged).toBe(10);
    expect(result.loanStatus.isPaid).toBe(true);
  });

  it("rejects an insufficient early-settlement payment", async () => {
    const prisma = {
      loan: {
        findUnique: jest.fn(async () => ({
          ...buildMonthlyInterestLoan(),
          earlySettlementInterestMode: EarlySettlementInterestMode.PRORATED_BY_DAYS,
        })),
      },
      loanPenalty: {
        findMany: jest.fn(async () => []),
      },
      loanInterest: {
        findMany: jest.fn(async () => [
          {
            id: "interest-1",
            periodStartDate: new Date("2026-04-01T00:00:00.000Z"),
            periodEndDate: new Date("2026-05-01T00:00:00.000Z"),
            interestAmount: 80000,
            interestPaid: 0,
            interestPending: 80000,
          },
        ]),
      },
      payment: {
        create: jest.fn(),
      },
    };

    const interestService = {
      ensureMonthlyInterestScheduleUpTo: jest.fn(async () => 0),
      applyPaymentToInterest: jest.fn(),
    };
    const penaltyService = {
      generateMonthlyInterestPenaltiesIncremental: jest.fn(async () => []),
      getTotalPendingPenalty: jest.fn(async () => 0),
      applyPaymentToPenalty: jest.fn(),
    };

    const service = new PaymentDistributionService(
      prisma as never,
      interestService as never,
      penaltyService as never,
    );

    await expect(
      service.processPayment(
        "loan-monthly-interest",
        "client-1",
        420000,
        new Date("2026-04-11T00:00:00.000Z"),
        {
          isEarlySettlement: true,
          earlySettlementInterestModeOverride: EarlySettlementInterestMode.PRORATED_BY_DAYS,
        },
      ),
    ).rejects.toThrow("Early settlement requires at least 430000.");

    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
