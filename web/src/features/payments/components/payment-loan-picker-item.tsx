import Link from "next/link";
import { PortfolioLoanItem } from "@/features/portfolio/types";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
} from "@/shared/lib/format";

type PaymentLoanPickerItemProps = {
  item: PortfolioLoanItem;
  href: string;
};

function getStatusLabel(item: PortfolioLoanItem) {
  if (item.operationalStatus === "OVERDUE") {
    return "Atrasado";
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "Hoy";
  }

  return "Al dia";
}

function getStatusTone(item: PortfolioLoanItem) {
  if (item.operationalStatus === "OVERDUE") {
    return "bg-[var(--danger-soft)] text-[var(--danger)]";
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "bg-[var(--warning-soft)] text-[var(--warning)]";
  }

  return "bg-[var(--brand-soft)] text-[var(--brand)]";
}

function getContextLabel(item: PortfolioLoanItem) {
  if (item.operationalStatus === "OVERDUE") {
    return `${item.daysLate ?? 0} dia(s) de atraso`;
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "Vence hoy";
  }

  return "Sin atraso";
}

export function PaymentLoanPickerItem({
  item,
  href,
}: PaymentLoanPickerItemProps) {
  return (
    <article className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_12px_28px_rgba(29,42,48,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {item.clientName}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {formatLoanType(item.type)} · {getContextLabel(item)}
          </p>
        </div>

        <div
          className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${getStatusTone(
            item,
          )}`}
        >
          {getStatusLabel(item)}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[1rem] bg-white/72 p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            Cobrable hoy
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {formatCurrency(item.totalCollectibleToday)}
          </p>
        </div>

        <div className="rounded-[1rem] bg-white/72 p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            Saldo pendiente
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {formatCurrency(item.outstandingBalance)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
        <span>Mora pendiente: {formatCurrency(item.penaltyPending)}</span>
        {item.oldestDueDate ? (
          <span>Desde: {formatDateShort(item.oldestDueDate)}</span>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          {item.loanId.slice(0, 8)}
        </span>
        <Link className="card-cta inline-flex items-center" href={href}>
          Seleccionar
        </Link>
      </div>
    </article>
  );
}
