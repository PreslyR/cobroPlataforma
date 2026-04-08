import Link from "next/link";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
} from "@/shared/lib/format";

type ClosedLoanItemProps = {
  item: {
    loanId: string;
    clientName: string;
    loanType: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    principalAmount: number;
    closedAt: string;
    finalPaymentAmount: number;
    finalAppliedToInterest: number;
    finalAppliedToPrincipal: number;
    finalAppliedToPenalty: number;
    wasEarlySettlement: boolean;
  };
  href: string;
};

export function ClosedLoanItem({
  item,
  href,
}: ClosedLoanItemProps) {
  return (
    <article className="rounded-[1.15rem] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {item.clientName}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {formatLoanType(item.loanType)} · Cerrado {formatDateShort(item.closedAt)}
          </p>
        </div>
        <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--success)]">
          Pagado
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="summary-pill">
          <span className="summary-pill-label">Monto original</span>
          <strong>{formatCurrency(item.principalAmount)}</strong>
        </div>
        <div className="summary-pill">
          <span className="summary-pill-label">Ultimo pago</span>
          <strong>{formatCurrency(item.finalPaymentAmount)}</strong>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--muted)]">
          {item.wasEarlySettlement ? "Cierre anticipado" : "Cierre regular"}
        </div>
        <Link className="card-cta" href={href}>
          Ver prestamo
        </Link>
      </div>
    </article>
  );
}
