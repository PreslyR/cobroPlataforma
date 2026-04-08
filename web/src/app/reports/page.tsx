import { MetricCard } from "@/features/dashboard/components/metric-card";
import { ClosedLoanItem } from "@/features/reports/components/closed-loan-item";
import { ReportPaymentItem } from "@/features/reports/components/report-payment-item";
import { getReportsPageData } from "@/features/reports/lib/api";
import { formatCurrency, formatLongDate } from "@/shared/lib/format";

type SearchParams = Promise<{
  lenderId?: string | string[];
  from?: string | string[];
  to?: string | string[];
}>;

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthStartInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-01`;
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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const lenderId =
    getSingleParam(resolvedSearchParams.lenderId) ??
    process.env.NEXT_PUBLIC_DEFAULT_LENDER_ID ??
    "";
  const today = new Date();
  const todayInput = toDateInputValue(today);
  const from = clampDateInputValue(
    getSingleParam(resolvedSearchParams.from) ?? getMonthStartInputValue(today),
    todayInput,
  );
  const to = clampDateInputValue(
    getSingleParam(resolvedSearchParams.to) ?? todayInput,
    todayInput,
  );
  const detailQueryString = buildQueryString({
    lenderId,
    date: to,
    origin: "reports",
    from,
    to,
  });
  if (!lenderId) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow">Configuracion inicial</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            Falta definir el prestamista activo.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Para abrir reportes, agrega <code>lenderId</code> en la URL o define
            <code>NEXT_PUBLIC_DEFAULT_LENDER_ID</code> en <code>web/.env.local</code>.
          </p>
        </section>
      </main>
    );
  }

  const reports = await getReportsPageData({ lenderId, from, to });

  if (!reports.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Reportes no disponibles</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar el historico del negocio.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en <code>{reports.meta.baseUrl}</code>.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {reports.error}
          </div>
        </section>
      </main>
    );
  }

  const {
    interestIncome,
    penaltyIncome,
    portfolioSummary,
    paymentsHistory,
    closedLoans,
  } = reports.data;

  return (
    <main className="page-shell">
        <section className="panel gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="eyebrow">Reportes</p>
              <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                Historico y lectura del negocio
              </h1>
              <p className="max-w-[28rem] text-sm leading-6 text-[var(--muted)]">
                Vista agregada para revisar ingresos, cartera al corte, pagos del periodo
                y prestamos ya cerrados.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-right">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                Corte
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                {formatLongDate(portfolioSummary.asOfDate)}
              </p>
            </div>
          </div>

          <form className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
            <label className="surface-field">
              <span className="surface-label">Desde</span>
              <input
                className="surface-input"
                type="date"
                name="from"
                defaultValue={from}
                max={todayInput}
              />
            </label>
            <label className="surface-field">
              <span className="surface-label">Hasta</span>
              <input
                className="surface-input"
                type="date"
                name="to"
                defaultValue={to}
                max={todayInput}
              />
            </label>
            <label className="surface-field">
              <span className="surface-label">Prestamista</span>
              <input
                className="surface-input font-mono text-xs"
                type="text"
                name="lenderId"
                defaultValue={lenderId}
              />
            </label>
            <button className="surface-button" type="submit">
              Actualizar
            </button>
          </form>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Recaudo total"
            value={formatCurrency(interestIncome.totalCollectedAmount)}
            meta={`${interestIncome.paymentsCount} pago(s)`}
            tone="brand"
          />
          <MetricCard
            label="Intereses cobrados"
            value={formatCurrency(interestIncome.totalInterestIncome)}
            meta={`Del ${from} al ${to}`}
            tone="success"
          />
          <MetricCard
            label="Mora cobrada"
            value={formatCurrency(penaltyIncome.totalPenaltyIncome)}
            meta={`Del ${from} al ${to}`}
            tone="warning"
          />
          <MetricCard
            label="Prestamos cerrados"
            value={String(closedLoans.totalCount)}
            meta="Dentro del rango"
            tone="neutral"
          />
        </section>

        <section className="panel gap-4">
          <div>
            <p className="eyebrow">Cartera al corte</p>
            <h2 className="section-title">Foto actual del negocio</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Activos"
              value={String(portfolioSummary.totals.activeLoans)}
              meta={`${portfolioSummary.totals.overdueLoans} atrasado(s)`}
              tone="neutral"
            />
            <MetricCard
              label="Capital pendiente"
              value={formatCurrency(portfolioSummary.totals.capitalPending)}
              meta={`Capital colocado ${formatCurrency(
                portfolioSummary.totals.principalPlaced,
              )}`}
              tone="brand"
            />
            <MetricCard
              label="Pendiente total"
              value={formatCurrency(portfolioSummary.totals.pendingTotal)}
              meta="Capital + interes + mora pendientes"
              tone="brand"
            />
            <MetricCard
              label="Interes pendiente"
              value={formatCurrency(portfolioSummary.totals.interestPending)}
              meta="Intereses aun no cobrados"
              tone="warning"
            />
            <MetricCard
              label="Mora pendiente"
              value={formatCurrency(portfolioSummary.totals.penaltyPending)}
              meta="Mora acumulada no cobrada"
              tone="warning"
            />
            <MetricCard
              label="Cobrable hoy"
              value={formatCurrency(portfolioSummary.totals.totalCollectibleToday)}
              meta={`Vencido ${formatCurrency(
                portfolioSummary.totals.overdueAmount,
              )}`}
              tone="danger"
            />
          </div>
        </section>

        <section className="panel gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Historial</p>
              <h2 className="section-title">Pagos del periodo</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {paymentsHistory.totalCount} registro(s)
            </p>
          </div>

          {paymentsHistory.items.length > 0 ? (
            <div className="space-y-3">
              {paymentsHistory.items.map((item) => (
                <ReportPaymentItem
                  key={item.id}
                  item={item}
                  href={`/loans/${item.loanId}${detailQueryString}`}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              No hay pagos registrados dentro del rango seleccionado.
            </div>
          )}
        </section>

        <section className="panel gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Cierres</p>
              <h2 className="section-title">Prestamos cerrados</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {closedLoans.totalCount} registro(s)
            </p>
          </div>

          {closedLoans.items.length > 0 ? (
            <div className="space-y-3">
              {closedLoans.items.map((item) => (
                <ClosedLoanItem
                  key={item.loanId}
                  item={item}
                  href={`/loans/${item.loanId}${detailQueryString}`}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              No hay prestamos cerrados dentro del rango seleccionado.
            </div>
          )}
        </section>
    </main>
  );
}
