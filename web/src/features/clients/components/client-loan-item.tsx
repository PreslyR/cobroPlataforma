import Link from "next/link";
import {
  formatCurrency,
  formatDateShort,
  formatLoanStatus,
  formatLoanType,
} from "@/shared/lib/format";

type ClientLoanItemProps = {
  item: {
    loanId: string;
    type: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    status: string;
    totalCollectibleToday: number;
    outstandingBalance: number;
    dueTodayAmount: number;
    overdueAmount: number;
    penaltyPending: number;
    daysLate: number | null;
    oldestDueDate: string | null;
  };
  href: string;
};

function getTone(item: ClientLoanItemProps["item"]) {
  if ((item.daysLate ?? 0) > 0) {
    return "bg-[var(--danger-soft)] text-[var(--danger)]";
  }

  if (item.dueTodayAmount > 0) {
    return "bg-[var(--warning-soft)] text-[var(--warning)]";
  }

  return "bg-[var(--brand-soft)] text-[var(--brand)]";
}

function getStatus(item: ClientLoanItemProps["item"]) {
  if ((item.daysLate ?? 0) > 0) {
    return `${item.daysLate} dia(s) de atraso`;
  }

  if (item.dueTodayAmount > 0) {
    return "Vence hoy";
  }

  return formatLoanStatus(item.status);
}

export function ClientLoanItem({
  item,
  href,
}: ClientLoanItemProps) {
  return (
    <article className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {formatLoanType(item.type)}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {getStatus(item)}
            {item.oldestDueDate ? ` · desde ${formatDateShort(item.oldestDueDate)}` : ""}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${getTone(
            item,
          )}`}
        >
          {formatLoanStatus(item.status)}
        </span>
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
        <span>Vencido: {formatCurrency(item.overdueAmount)}</span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          {item.loanId.slice(0, 8)}
        </span>
        <Link className="card-cta inline-flex items-center" href={href}>
          Ver prestamo
        </Link>
      </div>
    </article>
  );
}
