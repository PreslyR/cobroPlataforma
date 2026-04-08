import Link from "next/link";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
  formatSettlementMode,
} from "@/shared/lib/format";

type ReportPaymentItemProps = {
  item: {
    id: string;
    loanId: string;
    clientName: string;
    loanType: "FIXED_INSTALLMENTS" | "MONTHLY_INTEREST" | "DAILY_INTEREST";
    totalAmount: number;
    appliedToInterest: number;
    appliedToPrincipal: number;
    appliedToPenalty: number;
    paymentDate: string;
    isEarlySettlement: boolean;
    earlySettlementInterestModeUsed: "FULL_MONTH" | "PRORATED_BY_DAYS" | null;
    interestDaysCharged: number | null;
  };
  href: string;
};

export function ReportPaymentItem({
  item,
  href,
}: ReportPaymentItemProps) {
  return (
    <article className="rounded-[1.15rem] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {item.clientName}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {formatLoanType(item.loanType)} · {formatDateShort(item.paymentDate)}
          </p>
        </div>
        <p className="text-right text-lg font-semibold tracking-tight text-[var(--foreground)]">
          {formatCurrency(item.totalAmount)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="summary-pill">
          <span className="summary-pill-label">Interes</span>
          <strong>{formatCurrency(item.appliedToInterest)}</strong>
        </div>
        <div className="summary-pill">
          <span className="summary-pill-label">Capital</span>
          <strong>{formatCurrency(item.appliedToPrincipal)}</strong>
        </div>
        <div className="summary-pill">
          <span className="summary-pill-label">Mora</span>
          <strong>{formatCurrency(item.appliedToPenalty)}</strong>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm text-[var(--muted)]">
          {item.isEarlySettlement ? (
            <span>
              Liquidacion anticipada
              {item.earlySettlementInterestModeUsed
                ? ` · ${formatSettlementMode(
                    item.earlySettlementInterestModeUsed,
                  ).toLowerCase()}`
                : ""}
              {item.interestDaysCharged !== null &&
              item.interestDaysCharged !== undefined
                ? ` · ${item.interestDaysCharged} dia(s)`
                : ""}
            </span>
          ) : (
            <span>Pago regular</span>
          )}
        </div>
        <Link className="card-cta" href={href}>
          Ver prestamo
        </Link>
      </div>
    </article>
  );
}
