import Link from "next/link";
import { PortfolioLoanItem } from "@/features/portfolio/types";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
} from "@/shared/lib/format";
import styles from "./portfolio-loan-card.module.css";

type PortfolioLoanCardProps = {
  item: PortfolioLoanItem;
  queryString?: string;
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

function getContextLabel(item: PortfolioLoanItem) {
  if (item.operationalStatus === "OVERDUE") {
    return `${item.daysLate ?? 0} dia(s) de atraso`;
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "Vence hoy";
  }

  return "Sin atraso";
}

function getMetaLabel(item: PortfolioLoanItem) {
  if (item.operationalStatus === "CURRENT") {
    return formatLoanType(item.type);
  }

  return `${formatLoanType(item.type)} | ${getContextLabel(item)}`;
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

export function PortfolioLoanCard({
  item,
  queryString = "",
}: PortfolioLoanCardProps) {
  const contextAmount =
    item.operationalStatus === "OVERDUE"
      ? item.overdueAmount
      : item.dueTodayAmount;

  const contextLabel =
    item.operationalStatus === "OVERDUE" ? "Vencido" : "Monto del dia";

  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.copy}>
          <p className={styles.name}>{item.clientName}</p>
          <p className={styles.meta}>{getMetaLabel(item)}</p>
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
          <p className={styles.statLabel}>{contextLabel}</p>
          <p className={styles.statValue}>{formatCurrency(contextAmount)}</p>
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
          <span className={styles.footerNote}>
            Mora pendiente: {formatCurrency(item.penaltyPending)}
          </span>
          {item.oldestDueDate ? (
            <span className={styles.footerNote}>
              Desde: {formatDateShort(item.oldestDueDate)}
            </span>
          ) : item.operationalStatus !== "CURRENT" ? (
            <span className={styles.footerNote}>Estado: {getContextLabel(item)}</span>
          ) : null}
          <span className={styles.footerId}>{item.loanId.slice(0, 8)}</span>
        </div>

        <Link className={styles.footerCta} href={`/loans/${item.loanId}${queryString}`}>
          Ver prestamo
        </Link>
      </div>
    </article>
  );
}
