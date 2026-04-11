import Link from "next/link";
import { PortfolioLoanItem } from "@/features/portfolio/types";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
} from "@/shared/lib/format";
import styles from "./payment-loan-picker-item.module.css";

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
    return styles.statusDanger;
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return styles.statusWarning;
  }

  return styles.statusBrand;
}

function getContextLabel(item: PortfolioLoanItem) {
  if (item.operationalStatus === "OVERDUE") {
    return `${item.daysLate ?? 0} dia(s) de atraso`;
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "Vence hoy";
  }

  return "";
}

export function PaymentLoanPickerItem({
  item,
  href,
}: PaymentLoanPickerItemProps) {
  const contextLabel = getContextLabel(item);
  const meta = contextLabel
    ? `${formatLoanType(item.type)} | ${contextLabel}`
    : formatLoanType(item.type);

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.copy}>
          <p className={styles.name}>{item.clientName}</p>
          <p className={styles.meta}>{meta}</p>
        </div>

        <div className={`${styles.status} ${getStatusTone(item)}`}>
          {getStatusLabel(item)}
        </div>
      </div>

      <div className={styles.mainAmountBlock}>
        <p className={styles.label}>Total cobrable hoy</p>
        <p className={styles.mainAmount}>
          {formatCurrency(item.totalCollectibleToday)}
        </p>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Mora pendiente</p>
          <p className={styles.statValue}>{formatCurrency(item.penaltyPending)}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Saldo pendiente</p>
          <p className={styles.statValue}>
            {formatCurrency(item.outstandingBalance)}
          </p>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerMeta}>
          {item.oldestDueDate ? (
            <span className={styles.footerNote}>
              Desde: {formatDateShort(item.oldestDueDate)}
            </span>
          ) : (
            <span className={styles.footerNote}>Sin fecha vencida visible</span>
          )}
          <span className={styles.footerId}>{item.loanId.slice(0, 8)}</span>
        </div>
        <Link className={styles.footerCta} href={href}>
          Seleccionar
        </Link>
      </div>
    </article>
  );
}
