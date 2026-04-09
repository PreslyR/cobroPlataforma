import Link from "next/link";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
} from "@/shared/lib/format";
import styles from "./client-loan-item.module.css";

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

function getStatusLabel(item: ClientLoanItemProps["item"]) {
  if ((item.daysLate ?? 0) > 0) {
    return "Atrasado";
  }

  if (item.dueTodayAmount > 0) {
    return "Hoy";
  }

  return "Al dia";
}

function getStatusTone(item: ClientLoanItemProps["item"]) {
  if ((item.daysLate ?? 0) > 0) {
    return styles.statusDanger;
  }

  if (item.dueTodayAmount > 0) {
    return styles.statusWarning;
  }

  return styles.statusBrand;
}

function getMetaLabel(item: ClientLoanItemProps["item"]) {
  if ((item.daysLate ?? 0) > 0) {
    return `${formatLoanType(item.type)} | ${item.daysLate} dia(s) de atraso`;
  }

  if (item.dueTodayAmount > 0) {
    return `${formatLoanType(item.type)} | Vence hoy`;
  }

  return formatLoanType(item.type);
}

function getContextLabel(item: ClientLoanItemProps["item"]) {
  return (item.daysLate ?? 0) > 0 ? "Vencido" : "Monto del dia";
}

function getContextAmount(item: ClientLoanItemProps["item"]) {
  return (item.daysLate ?? 0) > 0 ? item.overdueAmount : item.dueTodayAmount;
}

export function ClientLoanItem({
  item,
  href,
}: ClientLoanItemProps) {
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.copy}>
          <p className={styles.name}>{getMetaLabel(item)}</p>
          {item.oldestDueDate ? (
            <p className={styles.meta}>Desde {formatDateShort(item.oldestDueDate)}</p>
          ) : null}
        </div>

        <div className={`${styles.status} ${getStatusTone(item)}`}>
          {getStatusLabel(item)}
        </div>
      </div>

      <div className={styles.mainAmountBlock}>
        <p className={styles.label}>Total cobrable hoy</p>
        <p className={styles.mainAmount}>{formatCurrency(item.totalCollectibleToday)}</p>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <p className={styles.statLabel}>{getContextLabel(item)}</p>
          <p className={styles.statValue}>{formatCurrency(getContextAmount(item))}</p>
        </div>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Saldo pendiente</p>
          <p className={styles.statValue}>{formatCurrency(item.outstandingBalance)}</p>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerMeta}>
          <span className={styles.footerNote}>
            Mora pendiente: {formatCurrency(item.penaltyPending)}
          </span>
          <span className={styles.footerId}>{item.loanId.slice(0, 8)}</span>
        </div>

        <Link className={styles.footerCta} href={href}>
          Ver prestamo
        </Link>
      </div>
    </article>
  );
}