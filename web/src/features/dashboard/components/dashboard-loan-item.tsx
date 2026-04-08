import Link from "next/link";
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
    <Link className="dashboard-loan-card" href={props.href}>
      <div className="dashboard-loan-card-head">
        <div className="dashboard-loan-card-copy">
          <p className="dashboard-loan-card-name">{item.clientName}</p>
          <div className="dashboard-loan-card-meta-row">
            <span className="dashboard-loan-card-type">
              {formatLoanType(item.type)}
            </span>
            <span className="dashboard-loan-card-id">{item.loanId.slice(0, 8)}</span>
          </div>
        </div>

        <div className="dashboard-loan-card-side">
          <div
            className={`dashboard-loan-card-status ${
              isOverdue
                ? "dashboard-loan-card-status-danger"
                : "dashboard-loan-card-status-brand"
            }`}
          >
            {statusLabel}
          </div>
          <span className="dashboard-loan-card-arrow" aria-hidden="true">
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

      <div className="dashboard-loan-card-amount-block">
        <p className="dashboard-loan-card-label">
          {isOverdue ? "Vencido" : "Monto del dia"}
        </p>
        <p className="dashboard-loan-card-amount">{formatCurrency(primaryAmount)}</p>
      </div>

      <div className="dashboard-loan-card-stats">
        <div className="dashboard-loan-card-stat">
          <p className="dashboard-loan-card-stat-label">Total cobrable</p>
          <p className="dashboard-loan-card-stat-value">
            {formatCurrency(item.totalCollectibleToday)}
          </p>
        </div>

        <div className="dashboard-loan-card-stat">
          <p className="dashboard-loan-card-stat-label">{secondaryLabel}</p>
          <p className="dashboard-loan-card-stat-value">{secondaryValue}</p>
        </div>
      </div>

      <div className="dashboard-loan-card-footer">
        <span>Mora {formatCurrency(item.penaltyPending)}</span>
      </div>
    </Link>
  );
}
