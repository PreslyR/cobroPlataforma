import Link from "next/link";
import { ClientLoanItem } from "@/features/clients/components/client-loan-item";
import { ClientPaymentItem } from "@/features/clients/components/client-payment-item";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { getClientDebt } from "@/features/clients/lib/api";
import { ContextHeader } from "@/shared/components/context-header";
import {
  formatCurrency,
  formatDateShort,
  formatLoanStatus,
  formatLoanType,
  formatLongDate,
} from "@/shared/lib/format";

type ClientDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    lenderId?: string | string[];
    date?: string | string[];
  }>;
};

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildQueryString(values: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function clampDateInputValue(value: string, maxValue: string) {
  return value > maxValue ? maxValue : value;
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: ClientDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const lenderId = getSingleParam(resolvedSearchParams.lenderId);
  const today = toDateInputValue(new Date());
  const date = clampDateInputValue(
    getSingleParam(resolvedSearchParams.date) ?? today,
    today,
  );
  const queryString = buildQueryString({ lenderId, date });

  const clientDebtResult = await getClientDebt({
    clientId: id,
    asOf: date,
  });

  if (!clientDebtResult.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Cliente no disponible</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar la ficha del cliente.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{clientDebtResult.meta.baseUrl}</code>.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {clientDebtResult.error}
          </div>
          <Link className="inline-link" href={`/clients${queryString}`}>
            Volver a clientes
          </Link>
        </section>
      </main>
    );
  }

  const { client, summary, activeLoans, closedLoans, recentPayments, asOfDate } =
    clientDebtResult.data;

  return (
    <main className="page-shell">
      <ContextHeader
        backHref={`/clients${queryString}`}
        backLabel="Volver a clientes"
        title="Cliente"
        subtitle={`${client.documentNumber}${client.phone ? ` · ${client.phone}` : ""}`}
        secondaryHref={`/portfolio${queryString}`}
        secondaryLabel="Cartera"
      />

      <section className="panel gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="eyebrow">Detalle de cliente</p>
            <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
              {client.fullName}
            </h1>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Documento {client.documentNumber}
              {client.phone ? ` · ${client.phone}` : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-right">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--muted)]">
              Corte
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
              {formatLongDate(asOfDate)}
            </p>
          </div>
        </div>

        <form className="grid grid-cols-[1fr_auto] gap-3">
          <input type="hidden" name="lenderId" value={lenderId ?? ""} />
          <label className="surface-field">
            <span className="surface-label">Fecha de corte</span>
            <input
              className="surface-input"
              type="date"
              name="date"
              defaultValue={date}
              max={today}
            />
          </label>
          <button className="surface-button" type="submit">
            Actualizar
          </button>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Cobrable hoy"
          value={formatCurrency(summary.totalCollectibleToday)}
          meta={formatCurrency(summary.outstandingBalance)}
          tone="brand"
        />
        <MetricCard
          label="Prestamos activos"
          value={String(summary.activeLoansCount)}
          meta={`${summary.overdueLoansCount} atrasado(s)`}
          tone="neutral"
        />
        <MetricCard
          label="Mora pendiente"
          value={formatCurrency(summary.penaltyPending)}
          meta={formatCurrency(summary.overdueAmount)}
          tone="danger"
        />
        <MetricCard
          label="Prestamos cerrados"
          value={String(summary.closedLoansCount)}
          meta={formatCurrency(summary.dueTodayAmount)}
          tone="warning"
        />
      </section>

      <section className="panel gap-4">
        <div>
          <p className="eyebrow">Ficha base</p>
          <h2 className="section-title">Datos del cliente</h2>
        </div>

        <div className="grid gap-3 text-sm">
          <div className="detail-row">
            <span>Prestamista</span>
            <strong>{client.lender.name}</strong>
          </div>
          <div className="detail-row">
            <span>Telefono</span>
            <strong>{client.phone || "Sin telefono"}</strong>
          </div>
          <div className="detail-row">
            <span>Direccion</span>
            <strong>{client.address || "Sin direccion"}</strong>
          </div>
          {client.notes ? (
            <div className="detail-row">
              <span>Notas</span>
              <strong>{client.notes}</strong>
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Prestamos activos</p>
            <h2 className="section-title">Operacion actual</h2>
          </div>
          <p className="text-sm text-[var(--muted)]">{activeLoans.length} registro(s)</p>
        </div>

        {activeLoans.length > 0 ? (
          <div className="space-y-3">
            {activeLoans.map((item) => (
              <ClientLoanItem
                key={item.loanId}
                item={item}
                href={`/loans/${item.loanId}${buildQueryString({
                  lenderId,
                  date,
                  origin: "client-detail",
                  clientId: id,
                })}`}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            Este cliente no tiene prestamos activos en este momento.
          </div>
        )}
      </section>

      <section className="panel gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Prestamos cerrados</p>
            <h2 className="section-title">Historial del cliente</h2>
          </div>
          <p className="text-sm text-[var(--muted)]">{closedLoans.length} registro(s)</p>
        </div>

        {closedLoans.length > 0 ? (
          <div className="space-y-3">
            {closedLoans.map((loan) => (
              <article
                key={loan.loanId}
                className="rounded-[1.15rem] border border-[var(--line)] bg-[var(--surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {formatLoanType(loan.type)}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {formatLoanStatus(loan.status)} · Cerrado {formatDateShort(loan.closedAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[var(--success)]">
                    {loan.wasEarlySettlement ? "Anticipado" : "Cerrado"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="summary-pill">
                    <span className="summary-pill-label">Monto original</span>
                    <strong>{formatCurrency(loan.principalAmount)}</strong>
                  </div>
                  <div className="summary-pill">
                    <span className="summary-pill-label">Ultimo pago</span>
                    <strong>{formatCurrency(loan.lastPaymentAmount)}</strong>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    {loan.loanId.slice(0, 8)}
                  </span>
                  <Link
                    className="card-cta"
                    href={`/loans/${loan.loanId}${buildQueryString({
                      lenderId,
                      date,
                      origin: "client-detail",
                      clientId: id,
                    })}`}
                  >
                    Ver prestamo
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            Todavia no hay prestamos cerrados para este cliente.
          </div>
        )}
      </section>

      <section className="panel gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Pagos recientes</p>
            <h2 className="section-title">Movimiento del cliente</h2>
          </div>
          <p className="text-sm text-[var(--muted)]">{recentPayments.length} registro(s)</p>
        </div>

        {recentPayments.length > 0 ? (
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <ClientPaymentItem
                key={payment.id}
                item={payment}
                href={`/loans/${payment.loanId}${buildQueryString({
                  lenderId,
                  date,
                  origin: "client-detail",
                  clientId: id,
                })}`}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            Este cliente todavia no tiene pagos registrados.
          </div>
        )}
      </section>
    </main>
  );
}
