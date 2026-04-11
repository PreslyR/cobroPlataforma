import { LoanType, PaymentFrequency } from "@prisma/client";
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
});