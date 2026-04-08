import {
  EarlySettlementInterestMode,
  LoanType,
  PaymentFrequency,
} from '@prisma/client';
import { LoansService } from '../src/loans/loans.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { InterestCalculationService } from '../src/payments/services/interest-calculation.service';
import { PenaltyCalculationService } from '../src/payments/services/penalty-calculation.service';
import { PaymentDistributionService } from '../src/payments/services/payment-distribution.service';

type ScenarioSummary = {
  code: string;
  description: string;
  loanId: string;
  loanType: LoanType;
};

const AS_OF_DATE = new Date(Date.UTC(2026, 2, 31));

function parseCliArg(name: string): string | undefined {
  const prefixed = `--${name}=`;
  const rawArg = process.argv.find((arg) => arg.startsWith(prefixed));
  return rawArg?.slice(prefixed.length);
}

async function main() {
  const lenderId = parseCliArg('lenderId');
  const clientId = parseCliArg('clientId');

  if (!lenderId || !clientId) {
    throw new Error(
      'Missing required arguments. Use --lenderId=<uuid> --clientId=<uuid>',
    );
  }

  const prisma = new PrismaService();
  await prisma.onModuleInit();

  const interestService = new InterestCalculationService(prisma);
  const penaltyService = new PenaltyCalculationService(prisma);
  const loansService = new LoansService(prisma, interestService, penaltyService);
  const paymentDistributionService = new PaymentDistributionService(
    prisma,
    interestService,
    penaltyService,
  );

  const scenarios: ScenarioSummary[] = [];

  try {
    // A. Cuotas fijas con pago exigible hoy, sin mora.
    const fixedDueToday = await loansService.create({
      lenderId,
      clientId,
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 90000,
      installmentAmount: 35000,
      totalInstallments: 3,
      paymentFrequency: PaymentFrequency.DAILY,
      startDate: '2026-03-30',
    });
    scenarios.push({
      code: 'FIXED_DUE_TODAY',
      description: 'Cuotas fijas con primera cuota venciendo el 2026-03-31.',
      loanId: fixedDueToday.id,
      loanType: fixedDueToday.type,
    });

    // B. Cuotas fijas atrasadas, sin pagos.
    const fixedOverdue = await loansService.create({
      lenderId,
      clientId,
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 80000,
      installmentAmount: 30000,
      totalInstallments: 3,
      paymentFrequency: PaymentFrequency.DAILY,
      startDate: '2026-03-27',
    });
    await penaltyService.generateFixedInstallmentPenaltiesIncremental(
      fixedOverdue.id,
      AS_OF_DATE,
    );
    scenarios.push({
      code: 'FIXED_OVERDUE',
      description: 'Cuotas fijas vencidas con mora materializada al 2026-03-31.',
      loanId: fixedOverdue.id,
      loanType: fixedOverdue.type,
    });

    // C. Cuotas fijas atrasadas con pago parcial.
    const fixedPartial = await loansService.create({
      lenderId,
      clientId,
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 100000,
      installmentAmount: 40000,
      totalInstallments: 3,
      paymentFrequency: PaymentFrequency.DAILY,
      startDate: '2026-03-25',
    });
    await paymentDistributionService.processPayment(
      fixedPartial.id,
      clientId,
      25000,
      new Date(Date.UTC(2026, 2, 29)),
    );
    await penaltyService.generateFixedInstallmentPenaltiesIncremental(
      fixedPartial.id,
      AS_OF_DATE,
    );
    scenarios.push({
      code: 'FIXED_PARTIAL',
      description: 'Cuotas fijas con pago parcial y saldo vencido pendiente.',
      loanId: fixedPartial.id,
      loanType: fixedPartial.type,
    });

    // D. Cuotas fijas completamente pagadas.
    const fixedPaid = await loansService.create({
      lenderId,
      clientId,
      type: LoanType.FIXED_INSTALLMENTS,
      principalAmount: 60000,
      installmentAmount: 22000,
      totalInstallments: 3,
      paymentFrequency: PaymentFrequency.DAILY,
      startDate: '2026-03-20',
    });
    await paymentDistributionService.processPayment(
      fixedPaid.id,
      clientId,
      66000,
      new Date(Date.UTC(2026, 2, 21)),
    );
    scenarios.push({
      code: 'FIXED_PAID',
      description: 'Cuotas fijas saldadas por completo.',
      loanId: fixedPaid.id,
      loanType: fixedPaid.type,
    });

    // E. Interés mensual vencido sin pagos.
    const monthlyOverdue = await loansService.create({
      lenderId,
      clientId,
      type: LoanType.MONTHLY_INTEREST,
      principalAmount: 500000,
      monthlyInterestRate: 0.15,
      paymentFrequency: PaymentFrequency.MONTHLY,
      startDate: '2026-01-25',
    });
    await interestService.ensureMonthlyInterestScheduleUpTo(
      monthlyOverdue.id,
      AS_OF_DATE,
    );
    await penaltyService.generateMonthlyInterestPenaltiesIncremental(
      monthlyOverdue.id,
      AS_OF_DATE,
    );
    scenarios.push({
      code: 'MONTHLY_OVERDUE',
      description: 'Interés mensual con períodos vencidos y sin pagos.',
      loanId: monthlyOverdue.id,
      loanType: monthlyOverdue.type,
    });

    // F. Interés mensual con pago parcial solo a intereses.
    const monthlyPartial = await loansService.create({
      lenderId,
      clientId,
      type: LoanType.MONTHLY_INTEREST,
      principalAmount: 400000,
      monthlyInterestRate: 0.12,
      paymentFrequency: PaymentFrequency.MONTHLY,
      startDate: '2026-01-20',
    });
    await paymentDistributionService.processPayment(
      monthlyPartial.id,
      clientId,
      20000,
      new Date(Date.UTC(2026, 1, 20)),
    );
    await interestService.ensureMonthlyInterestScheduleUpTo(
      monthlyPartial.id,
      AS_OF_DATE,
    );
    await penaltyService.generateMonthlyInterestPenaltiesIncremental(
      monthlyPartial.id,
      AS_OF_DATE,
    );
    scenarios.push({
      code: 'MONTHLY_PARTIAL',
      description: 'Interés mensual con pago parcial y rezago acumulado.',
      loanId: monthlyPartial.id,
      loanType: monthlyPartial.type,
    });

    // G. Interés mensual listo para probar payoff-preview.
    const monthlyPayoffCandidate = await loansService.create({
      lenderId,
      clientId,
      type: LoanType.MONTHLY_INTEREST,
      principalAmount: 450000,
      monthlyInterestRate: 0.14,
      paymentFrequency: PaymentFrequency.MONTHLY,
      startDate: '2026-03-18',
      earlySettlementInterestMode: EarlySettlementInterestMode.FULL_MONTH,
    });
    await interestService.ensureMonthlyInterestScheduleUpTo(
      monthlyPayoffCandidate.id,
      AS_OF_DATE,
    );
    await penaltyService.generateMonthlyInterestPenaltiesIncremental(
      monthlyPayoffCandidate.id,
      AS_OF_DATE,
    );
    scenarios.push({
      code: 'MONTHLY_PAYOFF_CANDIDATE',
      description: 'Interés mensual activo para probar payoff-preview y cierre anticipado.',
      loanId: monthlyPayoffCandidate.id,
      loanType: monthlyPayoffCandidate.type,
    });

    // H. Interés mensual ya liquidado anticipadamente.
    const monthlyPaidEarly = await loansService.create({
      lenderId,
      clientId,
      type: LoanType.MONTHLY_INTEREST,
      principalAmount: 300000,
      monthlyInterestRate: 0.15,
      paymentFrequency: PaymentFrequency.MONTHLY,
      startDate: '2026-03-05',
      earlySettlementInterestMode: EarlySettlementInterestMode.FULL_MONTH,
    });
    await paymentDistributionService.processPayment(
      monthlyPaidEarly.id,
      clientId,
      330000,
      new Date(Date.UTC(2026, 2, 20)),
      {
        isEarlySettlement: true,
        earlySettlementInterestModeOverride:
          EarlySettlementInterestMode.PRORATED_BY_DAYS,
      },
    );
    scenarios.push({
      code: 'MONTHLY_PAID_EARLY',
      description: 'Interés mensual saldado con liquidación anticipada prorrateada.',
      loanId: monthlyPaidEarly.id,
      loanType: monthlyPaidEarly.type,
    });

    console.log(
      `Escenarios creados con fecha de corte operativa ${AS_OF_DATE.toISOString().split('T')[0]}.`,
    );
    console.table(
      scenarios.map((scenario) => ({
        codigo: scenario.code,
        tipo: scenario.loanType,
        loanId: scenario.loanId,
        descripcion: scenario.description,
      })),
    );
  } finally {
    await prisma.onModuleDestroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
