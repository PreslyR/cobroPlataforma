import { LoanType } from "@prisma/client";
import { PenaltyCalculationService } from "./penalty-calculation.service";

describe("PenaltyCalculationService - weekly fixed installments", () => {
  it("generates a rounded penalty for a weekly overdue installment", async () => {
    const tx = {
      $queryRaw: jest.fn(async () => []),
      installment: {
        findMany: jest.fn(async () => []),
        updateMany: jest.fn(async () => ({ count: 0 })),
        update: jest.fn(async () => ({ id: "inst-1", status: "LATE" })),
      },
      loanPenalty: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => ({ id: "penalty-1", ...data })),
      },
      loan: {
        findUnique: jest.fn(async () => ({
          id: "loan-weekly",
          type: LoanType.FIXED_INSTALLMENTS,
          installments: [
            {
              id: "inst-1",
              dueDate: new Date("2026-04-04T00:00:00.000Z"),
              amount: 30000,
              status: "PENDING",
            },
          ],
        })),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const service = new PenaltyCalculationService(prisma as never);
    const penalties = await service.generateFixedInstallmentPenaltiesIncremental(
      "loan-weekly",
      new Date("2026-04-11T00:00:00.000Z"),
    );

    expect(tx.installment.update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: { status: "LATE" },
    });
    expect(tx.loanPenalty.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loanId: "loan-weekly",
        installmentId: "inst-1",
        daysLate: 7,
        penaltyAmount: 2000,
      }),
    });
    expect(penalties).toHaveLength(1);
  });
});

describe("PenaltyCalculationService - biweekly fixed installments", () => {
  it("generates a rounded penalty for a biweekly overdue installment", async () => {
    const tx = {
      $queryRaw: jest.fn(async () => []),
      installment: {
        findMany: jest.fn(async () => []),
        updateMany: jest.fn(async () => ({ count: 0 })),
        update: jest.fn(async () => ({ id: "inst-1", status: "LATE" })),
      },
      loanPenalty: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => ({ id: "penalty-1", ...data })),
      },
      loan: {
        findUnique: jest.fn(async () => ({
          id: "loan-biweekly",
          type: LoanType.FIXED_INSTALLMENTS,
          installments: [
            {
              id: "inst-1",
              dueDate: new Date("2026-03-28T00:00:00.000Z"),
              amount: 30000,
              status: "PENDING",
            },
          ],
        })),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const service = new PenaltyCalculationService(prisma as never);
    const penalties = await service.generateFixedInstallmentPenaltiesIncremental(
      "loan-biweekly",
      new Date("2026-04-11T00:00:00.000Z"),
    );

    expect(tx.installment.update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: { status: "LATE" },
    });
    expect(tx.loanPenalty.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loanId: "loan-biweekly",
        installmentId: "inst-1",
        daysLate: 14,
        penaltyAmount: 3000,
      }),
    });
    expect(penalties).toHaveLength(1);
  });
});


describe("PenaltyCalculationService - monthly fixed installments", () => {
  it("generates an exact penalty for a monthly overdue installment", async () => {
    const tx = {
      $queryRaw: jest.fn(async () => []),
      installment: {
        findMany: jest.fn(async () => []),
        updateMany: jest.fn(async () => ({ count: 0 })),
        update: jest.fn(async () => ({ id: "inst-1", status: "LATE" })),
      },
      loanPenalty: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        findFirst: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => ({ id: "penalty-1", ...data })),
      },
      loan: {
        findUnique: jest.fn(async () => ({
          id: "loan-monthly",
          type: LoanType.FIXED_INSTALLMENTS,
          installments: [
            {
              id: "inst-1",
              dueDate: new Date("2026-03-12T00:00:00.000Z"),
              amount: 30000,
              status: "PENDING",
            },
          ],
        })),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    const service = new PenaltyCalculationService(prisma as never);
    const penalties = await service.generateFixedInstallmentPenaltiesIncremental(
      "loan-monthly",
      new Date("2026-04-11T00:00:00.000Z"),
    );

    expect(tx.installment.update).toHaveBeenCalledWith({
      where: { id: "inst-1" },
      data: { status: "LATE" },
    });
    expect(tx.loanPenalty.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        loanId: "loan-monthly",
        installmentId: "inst-1",
        daysLate: 30,
        penaltyAmount: 6000,
      }),
    });
    expect(penalties).toHaveLength(1);
  });
});
