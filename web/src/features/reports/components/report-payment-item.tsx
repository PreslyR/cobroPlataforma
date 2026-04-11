import Link from "next/link";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
  formatSettlementMode,
} from "@/shared/lib/format";
import styles from "./report-payment-item.module.css";

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
  const operationLabel = item.isEarlySettlement
    ? "Liquidacion anticipada"
    : "Pago regular";
  const operationMeta = item.isEarlySettlement
    ? `${item.earlySettlementInterestModeUsed ? `${formatSettlementMode(item.earlySettlementInterestModeUsed).toLowerCase()}` : ""}${
        item.interestDaysCharged !== null && item.interestDaysCharged !== undefined
          ? `${item.earlySettlementInterestModeUsed ? " | " : ""}${item.interestDaysCharged} dia(s)`
          : ""
      }`
    : "Aplicado al flujo normal";

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.titleRow}>
          <div className={styles.titleBlock}>
            <p className={styles.clientName}>{item.clientName}</p>
            <p className={styles.meta}>
              {formatLoanType(item.loanType)} | {formatDateShort(item.paymentDate)}
            </p>
          </div>
          <p className={styles.amount}>{formatCurrency(item.totalAmount)}</p>
        </div>

        <div className={styles.badgeRow}>
          <span className={item.isEarlySettlement ? styles.badgeWarning : styles.badge}>
            {operationLabel}
          </span>
        </div>
      </div>

      <div className={styles.breakdown}>
        <div className={styles.cell}>
          <span className={styles.label}>Interes</span>
          <strong className={styles.value}>{formatCurrency(item.appliedToInterest)}</strong>
        </div>
        <div className={styles.cell}>
          <span className={styles.label}>Capital</span>
          <strong className={styles.value}>{formatCurrency(item.appliedToPrincipal)}</strong>
        </div>
        <div className={styles.cell}>
          <span className={styles.label}>Mora</span>
          <strong className={styles.value}>{formatCurrency(item.appliedToPenalty)}</strong>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerNote}>{operationMeta}</div>
        <Link className={styles.cta} href={href}>
          Ver prestamo
        </Link>
      </div>
    </article>
  );
}