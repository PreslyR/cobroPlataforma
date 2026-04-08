import { LoanDetailRecord } from "@/features/loan-detail/types";
import { formatCurrency, formatDateShort, formatSettlementMode } from "@/shared/lib/format";

type RecentPaymentItemProps = {
  payment: LoanDetailRecord["payments"][number];
};

export function RecentPaymentItem({ payment }: RecentPaymentItemProps) {
  return (
    <article className="rounded-[1.15rem] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {formatCurrency(payment.totalAmount)}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
            {formatDateShort(payment.paymentDate)}
          </p>
        </div>

        {payment.isEarlySettlement ? (
          <div className="rounded-full bg-[var(--brand-soft)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--brand)]">
            Liquidación
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm text-[var(--muted)]">
        <div>
          <p className="text-xs uppercase tracking-[0.08em]">Interés</p>
          <p className="mt-1 font-medium text-[var(--foreground)]">
            {formatCurrency(payment.appliedToInterest)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.08em]">Capital</p>
          <p className="mt-1 font-medium text-[var(--foreground)]">
            {formatCurrency(payment.appliedToPrincipal)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.08em]">Mora</p>
          <p className="mt-1 font-medium text-[var(--foreground)]">
            {formatCurrency(payment.appliedToPenalty)}
          </p>
        </div>
      </div>

      {payment.earlySettlementInterestModeUsed ? (
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          Modo usado: {formatSettlementMode(payment.earlySettlementInterestModeUsed)}
          {payment.interestDaysCharged !== null
            ? ` · ${payment.interestDaysCharged} día(s)`
            : ""}
        </p>
      ) : null}
    </article>
  );
}
