import Link from "next/link";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
} from "@/shared/lib/format";
import styles from "./closed-loan-item.module.css";

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
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.titleBlock}>
          <p className={styles.clientName}>{item.clientName}</p>
          <p className={styles.meta}>
            {formatLoanType(item.loanType)} | Cerrado {formatDateShort(item.closedAt)}
          </p>
        </div>
        <span className={styles.status}>Pagado</span>
      </div>

      <div className={styles.summary}>
        <div className={styles.cell}>
          <span className={styles.label}>Monto original</span>
          <strong className={styles.value}>{formatCurrency(item.principalAmount)}</strong>
        </div>
        <div className={styles.cell}>
          <span className={styles.label}>Ultimo pago</span>
          <strong className={styles.value}>{formatCurrency(item.finalPaymentAmount)}</strong>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerNote}>
          {item.wasEarlySettlement ? "Cierre anticipado" : "Cierre regular"}
        </div>
        <Link className={styles.cta} href={href}>
          Ver prestamo
        </Link>
      </div>
    </article>
  );
}