import { DashboardLoanItem } from "@/features/dashboard/components/dashboard-loan-item";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { getDashboardToday } from "@/features/dashboard/lib/api";
import { formatCurrency, formatLongDate } from "@/shared/lib/format";

type SearchParams = Promise<{
  date?: string | string[];
  lenderId?: string | string[];
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

export default async function Home({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const lenderId =
    getSingleParam(resolvedSearchParams.lenderId) ??
    process.env.NEXT_PUBLIC_DEFAULT_LENDER_ID ??
    "";
  const today = toDateInputValue(new Date());
  const date = clampDateInputValue(
    getSingleParam(resolvedSearchParams.date) ?? today,
    today,
  );
  const queryString = buildQueryString({ lenderId, date });

  if (!lenderId) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow">Configuracion inicial</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            Falta definir el prestamista activo.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Para probar el Dashboard, agrega <code>lenderId</code> en la URL o
            define <code>NEXT_PUBLIC_DEFAULT_LENDER_ID</code> en{" "}
            <code>web/.env.local</code>.
          </p>
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface-strong)]/70 p-4 font-mono text-sm text-[var(--foreground)]">
            /?lenderId=uuid-del-prestamista&amp;date=2026-03-31
          </div>
        </section>
      </main>
    );
  }

  const dashboard = await getDashboardToday({ lenderId, date });

  if (!dashboard.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Dashboard no disponible</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar el resumen operativo.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{dashboard.meta.baseUrl}</code> y que el prestamista tenga
            datos operativos.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {dashboard.error}
          </div>
        </section>
      </main>
    );
  }

  const { summary, sections } = dashboard.data;

  return (
    <main className="page-shell page-shell-home" id="top">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker">Resumen del dia</p>
          <h1 className="home-title">Buenos dias</h1>
          <p className="home-subtitle">
            Controla el cobro del dia y detecta rapido que cartera requiere
            seguimiento.
          </p>
        </div>

        <div className="home-hero-balance">
          <div>
            <p className="eyebrow">Cobrable hoy</p>
            <p className="home-hero-amount">
              {formatCurrency(summary.totalCollectibleToday)}
            </p>
            <p className="home-hero-meta">
              Vence hoy {formatCurrency(summary.dueTodayAmount)} · Atrasado{" "}
              {formatCurrency(summary.overdueAmount)}
            </p>
          </div>
          <div className="home-hero-date-card">
            <p className="home-hero-date-label">Fecha de corte</p>
            <p className="home-hero-date-value">
              {formatLongDate(dashboard.data.date)}
            </p>
          </div>
        </div>

        <div className="home-hero-accent" aria-hidden="true">
          <span className="home-hero-accent-stroke home-hero-accent-stroke-brand" />
          <span className="home-hero-accent-stroke home-hero-accent-stroke-sun" />
          <span className="home-hero-accent-stroke home-hero-accent-stroke-sky" />
        </div>
      </section>

      <section className="home-toolbar-panel">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Control del corte</p>
            <h2 className="section-title">Actualiza la foto del negocio</h2>
          </div>
        </div>

        <form className="home-toolbar-grid">
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

      <section className="home-section-block">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Pulso operativo</p>
            <h2 className="section-title">Lo que importa hoy</h2>
          </div>
          <p className="home-section-note">Vista rapida del negocio activo</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Vence hoy"
            value={formatCurrency(summary.dueTodayAmount)}
            meta={`${summary.dueTodayLoans} prestamo(s)`}
            tone="brand"
          />
          <MetricCard
            label="Atrasado"
            value={formatCurrency(summary.overdueAmount)}
            meta={`${summary.overdueLoans} prestamo(s)`}
            tone="danger"
          />
          <MetricCard
            label="Intereses del mes"
            value={formatCurrency(summary.monthInterestIncome)}
            meta={`Recaudo del mes ${formatCurrency(summary.monthCollectedAmount)}`}
            tone="success"
          />
          <MetricCard
            label="Mora pendiente"
            value={formatCurrency(summary.penaltyPending)}
            meta="Pendiente acumulada"
            tone="warning"
          />
          <MetricCard
            label="Prestamos activos"
            value={String(summary.activeLoans)}
            meta={`${summary.overdueLoans} atrasado(s)`}
            tone="neutral"
          />
          <MetricCard
            label="Recaudo del dia"
            value={formatCurrency(summary.todayCollectedAmount)}
            meta={`${summary.todayPaymentsCount} pago(s)`}
            tone="neutral"
          />
        </div>
      </section>

      <section className="home-section-block" id="due-today">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Cobros de hoy</p>
            <h2 className="section-title">Vencen hoy</h2>
          </div>
          <p className="home-section-note">
            {sections.dueToday.length} registro(s)
          </p>
        </div>

        {sections.dueToday.length > 0 ? (
          <div className="space-y-3">
            {sections.dueToday.map((item) => (
              <DashboardLoanItem
                key={item.loanId}
                item={item}
                kind="dueToday"
                href={`/loans/${item.loanId}${buildQueryString({
                  lenderId,
                  date,
                  origin: "dashboard",
                  clientId: item.clientId,
                })}`}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            No hay vencimientos programados para esta fecha.
          </div>
        )}
      </section>

      <section className="home-section-block" id="overdue">
        <div className="home-section-heading">
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2 className="section-title">Atrasados</h2>
          </div>
          <p className="home-section-note">Cobro que requiere atencion</p>
        </div>

        {sections.overdue.length > 0 ? (
          <div className="space-y-3">
            {sections.overdue.map((item) => (
              <DashboardLoanItem
                key={item.loanId}
                item={item}
                kind="overdue"
                href={`/loans/${item.loanId}${buildQueryString({
                  lenderId,
                  date,
                  origin: "dashboard",
                  clientId: item.clientId,
                })}`}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            No hay cartera vencida para esta fecha.
          </div>
        )}
      </section>
    </main>
  );
}
