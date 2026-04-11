import { LoanStatus, LoanType } from "@prisma/client";
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
