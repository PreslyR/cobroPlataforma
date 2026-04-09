import Link from "next/link";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
  formatSettlementMode,
} from "@/shared/lib/format";
import styles from "./client-payment-item.module.css";

type ClientPaymentItemProps = {
  item: {
    id: string;
    loanId: string;
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

function getPaymentNote(item: ClientPaymentItemProps["item"]) {
  if (!item.isEarlySettlement) {
    return "Pago regular";
  }

  const parts = ["Liquidacion anticipada"];

  if (item.earlySettlementInterestModeUsed) {
    parts.push(formatSettlementMode(item.earlySettlementInterestModeUsed).toLowerCase());
  }

  if (item.interestDaysCharged !== null && item.interestDaysCharged !== undefined) {
    parts.push(`${item.interestDaysCharged} dia(s)`);
  }

  return parts.join(" | ");
}

export function ClientPaymentItem({
  item,
  href,
}: ClientPaymentItemProps) {
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.copy}>
          <p className={styles.name}>{formatLoanType(item.loanType)}</p>
          <p className={styles.meta}>{formatDateShort(item.paymentDate)}</p>
        </div>
        <p className={styles.amount}>{formatCurrency(item.totalAmount)}</p>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Interes</span>
          <strong className={styles.statValue}>{formatCurrency(item.appliedToInterest)}</strong>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Capital</span>
          <strong className={styles.statValue}>{formatCurrency(item.appliedToPrincipal)}</strong>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Mora</span>
          <strong className={styles.statValue}>{formatCurrency(item.appliedToPenalty)}</strong>
        </div>
      </div>

      <div className={styles.footer}>
        <p className={styles.footerNote}>{getPaymentNote(item)}</p>
        <Link className={styles.footerCta} href={href}>
          Ver prestamo
        </Link>
      </div>
    </article>
  );
}