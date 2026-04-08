import Link from "next/link";
import { ClientsPortfolioResponse } from "@/features/clients/types";
import {
  formatCurrency,
  formatDateShort,
} from "@/shared/lib/format";

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
    return "bg-[var(--danger-soft)] text-[var(--danger)]";
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "bg-[var(--warning-soft)] text-[var(--warning)]";
  }

  return "bg-[var(--brand-soft)] text-[var(--brand)]";
}

function getContext(item: ClientPortfolioCardProps["item"]) {
  if (item.operationalStatus === "OVERDUE") {
    return `${item.daysLate ?? 0} dia(s) de atraso`;
  }

  if (item.operationalStatus === "DUE_TODAY") {
    return "Tiene vencimientos hoy";
  }

  return "Sin atraso";
}

export function ClientPortfolioCard({
  item,
  href,
}: ClientPortfolioCardProps) {
  return (
    <article className="rounded-[1.45rem] border border-[var(--line)] bg-white/84 p-4 shadow-[0_14px_32px_rgba(29,42,48,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {item.fullName}
          </p>
          <p className="text-sm text-[var(--muted)]">
            Documento {item.documentNumber}
            {item.phone ? ` · ${item.phone}` : ""}
          </p>
        </div>

        <div
          className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${getStatusTone(
            item,
          )}`}
        >
          {getStatusLabel(item)}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
          Total cobrable hoy
        </p>
        <p className="mt-1 text-[2rem] font-semibold leading-none tracking-tight text-[var(--foreground)]">
          {formatCurrency(item.totalCollectibleToday)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-[var(--surface)] p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            Prestamos activos
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {item.activeLoansCount}
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--surface)] p-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            Saldo pendiente
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            {formatCurrency(item.outstandingBalance)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[var(--muted)]">
        <span>{getContext(item)}</span>
        <span>Mora pendiente: {formatCurrency(item.penaltyPending)}</span>
        {item.oldestDueDate ? (
          <span>Desde: {formatDateShort(item.oldestDueDate)}</span>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          {item.clientId.slice(0, 8)}
        </span>
        <Link className="card-cta inline-flex items-center" href={href}>
          Ver cliente
        </Link>
      </div>
    </article>
  );
}
