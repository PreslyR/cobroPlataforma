import Link from "next/link";
import { ClientsPortfolioResponse } from "@/features/clients/types";
import { formatCurrency, formatDateShort } from "@/shared/lib/format";
import styles from "./client-portfolio-card.module.css";

type ClientPortfolioCardProps = {
  item: ClientsPortfolioResponse["items"][number];
  href: string;
};

function getStatusLabel(item: ClientPortfolioCardProps["item"]) {
  if (item.operationalStatus === "OVERDUE") {
    return "Atrasado";
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "Hoy";
  }

  return "Al dia";
}

function getStatusTone(item: ClientPortfolioCardProps["item"]) {
  if (item.operationalStatus === "OVERDUE") {
    return styles.statusDanger;
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return styles.statusWarning;
  }

  return styles.statusBrand;
}

function getContext(item: ClientPortfolioCardProps["item"]) {
  if (item.operationalStatus === "OVERDUE") {
    return item.overdueLoansCount === 1
      ? "1 prestamo atrasado"
      : `${item.overdueLoansCount} prestamos atrasados`;
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "Tiene vencimientos hoy";
  }

  return "Sin atraso";
}

function getMetaLabel(item: ClientPortfolioCardProps["item"]) {
  return `C.C. ${item.documentNumber}`;
}

function getOldestDueLabel(item: ClientPortfolioCardProps["item"]) {
  if (!item.oldestDueDate) {
    return null;
  }

  return item.overdueLoansCount > 1
    ? `Atraso mas antiguo: ${formatDateShort(item.oldestDueDate)}`
    : `Desde: ${formatDateShort(item.oldestDueDate)}`;
}

export function ClientPortfolioCard({
  item,
  href,
}: ClientPortfolioCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.head}>
        <div className={styles.copy}>
          <p className={styles.name}>{item.fullName}</p>
          <p className={styles.meta}>{getMetaLabel(item)}</p>
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
          <p className={styles.statLabel}>Prestamos activos</p>
          <p className={styles.statValue}>{item.activeLoansCount}</p>
        </div>

        <div className={styles.stat}>
          <p className={styles.statLabel}>Saldo pendiente</p>
          <p className={styles.statValue}>{formatCurrency(item.outstandingBalance)}</p>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerMeta}>
          {item.operationalStatus !== "CURRENT" ? (
            <span className={styles.footerNote}>{getContext(item)}</span>
          ) : null}
          <span className={styles.footerNote}>
            Mora pendiente: {formatCurrency(item.penaltyPending)}
          </span>
          {getOldestDueLabel(item) ? (
            <span className={styles.footerNote}>{getOldestDueLabel(item)}</span>
          ) : null}
          <span className={styles.footerId}>{item.clientId.slice(0, 8)}</span>
        </div>

        <Link className={styles.footerCta} href={href}>
          Ver cliente
        </Link>
      </div>
    </article>
  );
}
