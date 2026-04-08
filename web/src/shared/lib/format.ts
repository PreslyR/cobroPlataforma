const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const longDateFormatter = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const percentFormatter = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 0,
});

const loanTypeLabels = {
  FIXED_INSTALLMENTS: "Cuotas fijas",
  DAILY_INTEREST: "Interes diario",
  MONTHLY_INTEREST: "Interes mensual",
} as const;

const paymentFrequencyLabels = {
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
} as const;

const loanStatusLabels = {
  ACTIVE: "Activo",
  PAID: "Pagado",
  CANCELLED: "Cancelado",
  DEFAULTED: "Incumplido",
} as const;

const settlementModeLabels = {
  FULL_MONTH: "Mes completo",
  PRORATED_BY_DAYS: "Prorrateado por dias",
} as const;

const installmentStatusLabels = {
  PENDING: "Pendiente",
  LATE: "Atrasada",
  PAID: "Pagada",
} as const;

export function formatCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

export function formatLongDate(value: string | Date) {
  return longDateFormatter.format(new Date(value));
}

export function formatDateShort(value: string | Date) {
  return shortDateFormatter.format(new Date(value));
}

export function formatLoanType(
  value: keyof typeof loanTypeLabels | string,
) {
  if (value in loanTypeLabels) {
    return loanTypeLabels[value as keyof typeof loanTypeLabels];
  }

  return value;
}

export function formatPaymentFrequency(
  value: keyof typeof paymentFrequencyLabels | string,
) {
  if (value in paymentFrequencyLabels) {
    return paymentFrequencyLabels[value as keyof typeof paymentFrequencyLabels];
  }

  return value;
}

export function formatLoanStatus(
  value: keyof typeof loanStatusLabels | string,
) {
  if (value in loanStatusLabels) {
    return loanStatusLabels[value as keyof typeof loanStatusLabels];
  }

  return value;
}

export function formatSettlementMode(
  value: keyof typeof settlementModeLabels | string,
) {
  if (value in settlementModeLabels) {
    return settlementModeLabels[value as keyof typeof settlementModeLabels];
  }

  return value;
}

export function formatInstallmentStatus(
  value: keyof typeof installmentStatusLabels | string,
) {
  if (value in installmentStatusLabels) {
    return installmentStatusLabels[value as keyof typeof installmentStatusLabels];
  }

  return value;
}

export function formatPercentage(value: number | null | undefined) {
  return percentFormatter.format(value ?? 0);
}
