import Link from "next/link";
import styles from "./dashboard-loan-item.module.css";
import {
  DashboardDueTodayItem,
  DashboardOverdueItem,
} from "@/features/dashboard/types";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
} from "@/shared/lib/format";

type DashboardLoanItemProps =
  | { kind: "dueToday"; item: DashboardDueTodayItem; href: string }
  | { kind: "overdue"; item: DashboardOverdueItem; href: string };

export function DashboardLoanItem(props: DashboardLoanItemProps) {
  const isOverdue = props.kind === "overdue";
  const item = props.item;
  const statusLabel = isOverdue ? `${props.item.daysLate} dia(s)` : "Hoy";
  const primaryAmount = isOverdue
    ? props.item.overdueAmount
    : props.item.dueTodayAmount;
  const secondaryLabel = isOverdue ? "Desde" : "Saldo";
  const secondaryValue = isOverdue
    ? formatDateShort(props.item.oldestDueDate)
    : formatCurrency(props.item.outstandingBalance);

  return (
    <Link className={styles.card} href={props.href}>
      <div className={styles.head}>
        <div className={styles.copy}>
          <p className={styles.name}>{item.clientName}</p>
          <div className={styles.metaRow}>
            <span className={styles.type}>
              {formatLoanType(item.type)}
            </span>
            <span className={styles.id}>{item.loanId.slice(0, 8)}</span>
          </div>
        </div>

        <div className={styles.side}>
          <div
            className={`${styles.status} ${
              isOverdue ? styles.statusDanger : styles.statusBrand
            }`}
          >
            {statusLabel}
          </div>
          <span className={styles.arrow} aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path
                d="M7.5 4.5L13 10L7.5 15.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>

      <div className={styles.amountBlock}>
        <p className={styles.label}>
          {isOverdue ? "Vencido" : "Monto del dia"}
        </p>
        <p className={styles.amount}>{formatCurrency(primaryAmount)}</p>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <p className={styles.statLabel}>Total cobrable</p>
          <p className={styles.statValue}>
            {formatCurrency(item.totalCollectibleToday)}
          </p>
        </div>

        <div className={styles.stat}>
          <p className={styles.statLabel}>{secondaryLabel}</p>
          <p className={styles.statValue}>{secondaryValue}</p>
        </div>
      </div>

      <div className={styles.footer}>
        <span>Mora {formatCurrency(item.penaltyPending)}</span>
      </div>
    </Link>
  );
}
