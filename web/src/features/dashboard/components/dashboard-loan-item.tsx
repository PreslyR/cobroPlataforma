import Link from "next/link";
import {
  DashboardDueTodayItem,
  DashboardOverdueItem,
} from "@/features/dashboard/types";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
} from "@/shared/lib/format";

type DashboardLoanItemProps =
  | { kind: "dueToday"; item: DashboardDueTodayItem; href: string }
  | { kind: "overdue"; item: DashboardOverdueItem; href: string };

export function DashboardLoanItem(props: DashboardLoanItemProps) {
  const isOverdue = props.kind === "overdue";
  const item = props.item;
  const statusLabel = isOverdue ? `${props.item.daysLate} dia(s)` : "Hoy";
  const primaryAmount = isOverdue
    ? props.item.overdueAmount
    : props.item.dueTodayAmount;
  const secondaryLabel = isOverdue ? "Desde" : "Saldo";
  const secondaryValue = isOverdue
    ? formatDateShort(props.item.oldestDueDate)
    : formatCurrency(props.item.outstandingBalance);

  return (
    <Link
      className="block rounded-[1.4rem] border border-[var(--line)] bg-white/80 p-4 shadow-[0_12px_30px_rgba(29,42,48,0.06)] transition-transform duration-200 hover:-translate-y-[1px]"
      href={props.href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {item.clientName}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="rounded-full bg-[var(--surface-strong)] px-2.5 py-1 font-medium text-[var(--foreground)]">
              {formatLoanType(item.type)}
            </span>
            <span className="font-mono uppercase tracking-[0.12em]">
              {item.loanId.slice(0, 8)}
            </span>
          </div>
        </div>

        <div
          className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${
            isOverdue
              ? "bg-[var(--danger-soft)] text-[var(--danger)]"
              : "bg-[var(--brand-soft)] text-[var(--brand)]"
          }`}
        >
          {statusLabel}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-[var(--surface)] p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            {isOverdue ? "Vencido" : "Monto del dia"}
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {formatCurrency(primaryAmount)}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--surface)] p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            Total cobrable
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {formatCurrency(item.totalCollectibleToday)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
        <span>Mora: {formatCurrency(item.penaltyPending)}</span>
        <span>
          {secondaryLabel}: {secondaryValue}
        </span>
      </div>
    </Link>
  );
}
