import { DashboardLoanItem } from "@/features/dashboard/components/dashboard-loan-item";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { type DashboardResult } from "@/features/dashboard/lib/api";
import { formatCurrency, formatLongDate } from "@/shared/lib/format";
import styles from "./home.module.css";

type DashboardPromise = Promise<DashboardResult>;

type DashboardSectionProps = {
  dashboardPromise: DashboardPromise;
  date: string;
};

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

function DashboardFetchError({ baseUrl, error }: { baseUrl: string; error: string }) {
  return (
    <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
      No pude cargar el Dashboard desde <code>{baseUrl}</code>. {error}
    </div>
  );
}

export function DashboardHeroCopyFallback() {
  return (
    <div className={styles.homeHeroCopy}>
      <h1 className={styles.homeTitle}>Hola</h1>
      <p className={styles.homeSubtitle}>Cargando cobrable de hoy.</p>
    </div>
  );
}

export async function DashboardHeroCopy({
  dashboardPromise,
}: {
  dashboardPromise: DashboardPromise;
}) {
  const dashboard = await dashboardPromise;

  if (!dashboard.ok) {
    return <DashboardHeroCopyFallback />;
  }

  return (
    <div className={styles.homeHeroCopy}>
      <h1 className={styles.homeTitle}>
        Hola{dashboard.data.lenderName ? `, ${dashboard.data.lenderName}` : ""}
      </h1>
      <p className={styles.homeSubtitle}>Cobrable hoy y cartera por atender.</p>
    </div>
  );
}

export function DashboardHeroSummaryFallback({ today }: { today: string }) {
  return (
    <section className={styles.homeHeroSummary}>
      <div className={styles.homeFloatingDateCard}>
        <div className={styles.homeFloatingDateIconWrap} aria-hidden="true">
          <span className={styles.homeFloatingDateIconCore}>
            <svg
              className={styles.homeFloatingDateIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.5" y="5" width="17" height="15" rx="3" />
              <path d="M8 3.5v3" />
              <path d="M16 3.5v3" />
              <path d="M3.5 9.5h17" />
            </svg>
          </span>
        </div>
        <div className={styles.homeFloatingDateCopy}>
          <p className={styles.homeFloatingDateLabel}>Fecha de corte</p>
          <p className={styles.homeFloatingDateValue}>{today}</p>
        </div>
      </div>

      <div className={styles.homeHeroBalance}>
        <div>
          <p className="eyebrow">Cobrable hoy</p>
          <p className={styles.homeHeroAmount}>...</p>
          <p className={styles.homeHeroMeta}>Cargando resumen operativo.</p>
        </div>
      </div>
    </section>
  );
}

export async function DashboardHeroSummary({
  dashboardPromise,
  today,
}: {
  dashboardPromise: DashboardPromise;
  today: string;
}) {
  const dashboard = await dashboardPromise;

  if (!dashboard.ok) {
    return (
      <>
        <DashboardHeroSummaryFallback today={today} />
        <DashboardFetchError
          baseUrl={dashboard.meta.baseUrl}
          error={dashboard.error}
        />
      </>
    );
  }

  const { summary } = dashboard.data;

  return (
    <section className={styles.homeHeroSummary}>
      <div className={styles.homeFloatingDateCard}>
        <div className={styles.homeFloatingDateIconWrap} aria-hidden="true">
          <span className={styles.homeFloatingDateIconCore}>
            <svg
              className={styles.homeFloatingDateIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.5" y="5" width="17" height="15" rx="3" />
              <path d="M8 3.5v3" />
              <path d="M16 3.5v3" />
              <path d="M3.5 9.5h17" />
            </svg>
          </span>
        </div>
        <div className={styles.homeFloatingDateCopy}>
          <p className={styles.homeFloatingDateLabel}>Fecha de corte</p>
          <p className={styles.homeFloatingDateValue}>
            {formatLongDate(dashboard.data.date)}
          </p>
        </div>
      </div>

      <div className={styles.homeHeroBalance}>
        <div>
          <p className="eyebrow">Cobrable hoy</p>
          <p className={styles.homeHeroAmount}>
            {formatCurrency(summary.totalCollectibleToday)}
          </p>
          <p className={styles.homeHeroMeta}>
            Vence hoy {formatCurrency(summary.dueTodayAmount)} | Atrasado{" "}
            {formatCurrency(summary.overdueAmount)}
          </p>
        </div>
      </div>
    </section>
  );
}

export function DashboardMetricsFallback() {
  return (
    <section className={styles.homeSectionBlock}>
      <div className={styles.homeSectionHeading}>
        <div>
          <p className="eyebrow">Pulso operativo</p>
          <h2 className="section-title">Lo que importa hoy</h2>
        </div>
        <p className={styles.homeSectionNote}>Cargando</p>
      </div>

      <div className={styles.homeMetricsPanel}>
        <MetricCard label="Vence hoy" value="..." meta="Cargando" tone="brand" variant="embedded" />
        <MetricCard label="Atrasado" value="..." meta="Cargando" tone="danger" variant="embedded" />
        <MetricCard label="Intereses del mes" value="..." meta="Cargando" tone="success" variant="embedded" />
        <MetricCard label="Mora pendiente" value="..." meta="Cargando" tone="warning" variant="embedded" />
        <MetricCard label="Prestamos activos" value="..." meta="Cargando" tone="neutral" variant="embedded" />
        <MetricCard label="Recaudo del dia" value="..." meta="Cargando" tone="neutral" variant="embedded" />
      </div>
    </section>
  );
}

export async function DashboardMetricsSection({
  dashboardPromise,
}: {
  dashboardPromise: DashboardPromise;
}) {
  const dashboard = await dashboardPromise;

  if (!dashboard.ok) {
    return (
      <section className={styles.homeSectionBlock}>
        <div className={styles.homeSectionHeading}>
          <div>
            <p className="eyebrow">Pulso operativo</p>
            <h2 className="section-title">Lo que importa hoy</h2>
          </div>
          <p className={styles.homeSectionNote}>Sin datos</p>
        </div>
        <DashboardFetchError
          baseUrl={dashboard.meta.baseUrl}
          error={dashboard.error}
        />
      </section>
    );
  }

  const { summary } = dashboard.data;

  return (
    <section className={styles.homeSectionBlock}>
      <div className={styles.homeSectionHeading}>
        <div>
          <p className="eyebrow">Pulso operativo</p>
          <h2 className="section-title">Lo que importa hoy</h2>
        </div>
        <p className={styles.homeSectionNote}>Vista rapida del negocio activo</p>
      </div>

      <div className={styles.homeMetricsPanel}>
        <MetricCard
          label="Vence hoy"
          value={formatCurrency(summary.dueTodayAmount)}
          meta={`${summary.dueTodayLoans} prestamo(s)`}
          tone="brand"
          variant="embedded"
        />
        <MetricCard
          label="Atrasado"
          value={formatCurrency(summary.overdueAmount)}
          meta={`${summary.overdueLoans} prestamo(s)`}
          tone="danger"
          variant="embedded"
        />
        <MetricCard
          label="Intereses del mes"
          value={formatCurrency(summary.monthInterestIncome)}
          meta={`Recaudo del mes ${formatCurrency(summary.monthCollectedAmount)}`}
          tone="success"
          variant="embedded"
        />
        <MetricCard
          label="Mora pendiente"
          value={formatCurrency(summary.penaltyPending)}
          meta="Pendiente acumulada"
          tone="warning"
          variant="embedded"
        />
        <MetricCard
          label="Prestamos activos"
          value={String(summary.activeLoans)}
          meta={`${summary.overdueLoans} atrasado(s)`}
          tone="neutral"
          variant="embedded"
        />
        <MetricCard
          label="Recaudo del dia"
          value={formatCurrency(summary.todayCollectedAmount)}
          meta={`${summary.todayPaymentsCount} pago(s)`}
          tone="neutral"
          variant="embedded"
        />
      </div>
    </section>
  );
}

export function DashboardDueTodayFallback() {
  return (
    <section className={styles.homeSectionBlock} id="due-today">
      <div className={styles.homeSectionHeading}>
        <div>
          <p className="eyebrow">Cobros de hoy</p>
          <h2 className="section-title">Vencen hoy</h2>
        </div>
        <p className={styles.homeSectionNote}>Cargando</p>
      </div>
      <div className="empty-panel">Cargando cobros de hoy.</div>
    </section>
  );
}

export async function DashboardDueTodaySection({
  dashboardPromise,
  date,
}: DashboardSectionProps) {
  const dashboard = await dashboardPromise;

  if (!dashboard.ok) {
    return (
      <section className={styles.homeSectionBlock} id="due-today">
        <div className={styles.homeSectionHeading}>
          <div>
            <p className="eyebrow">Cobros de hoy</p>
            <h2 className="section-title">Vencen hoy</h2>
          </div>
          <p className={styles.homeSectionNote}>Sin datos</p>
        </div>
        <DashboardFetchError
          baseUrl={dashboard.meta.baseUrl}
          error={dashboard.error}
        />
      </section>
    );
  }

  const items = dashboard.data.sections.dueToday;

  return (
    <section className={styles.homeSectionBlock} id="due-today">
      <div className={styles.homeSectionHeading}>
        <div>
          <p className="eyebrow">Cobros de hoy</p>
          <h2 className="section-title">Vencen hoy</h2>
        </div>
        <p className={styles.homeSectionNote}>{items.length} registro(s)</p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <DashboardLoanItem
              key={item.loanId}
              item={item}
              kind="dueToday"
              href={`/loans/${item.loanId}${buildQueryString({
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
  );
}

export function DashboardOverdueFallback() {
  return (
    <section className={styles.homeSectionBlock} id="overdue">
      <div className={styles.homeSectionHeading}>
        <div>
          <p className="eyebrow">Seguimiento</p>
          <h2 className="section-title">Atrasados</h2>
        </div>
        <p className={styles.homeSectionNote}>Cargando</p>
      </div>
      <div className="empty-panel">Cargando cartera atrasada.</div>
    </section>
  );
}

export async function DashboardOverdueSection({
  dashboardPromise,
  date,
}: DashboardSectionProps) {
  const dashboard = await dashboardPromise;

  if (!dashboard.ok) {
    return (
      <section className={styles.homeSectionBlock} id="overdue">
        <div className={styles.homeSectionHeading}>
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2 className="section-title">Atrasados</h2>
          </div>
          <p className={styles.homeSectionNote}>Sin datos</p>
        </div>
        <DashboardFetchError
          baseUrl={dashboard.meta.baseUrl}
          error={dashboard.error}
        />
      </section>
    );
  }

  const items = dashboard.data.sections.overdue;

  return (
    <section className={styles.homeSectionBlock} id="overdue">
      <div className={styles.homeSectionHeading}>
        <div>
          <p className="eyebrow">Seguimiento</p>
          <h2 className="section-title">Atrasados</h2>
        </div>
        <p className={styles.homeSectionNote}>Cobro que requiere atencion</p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <DashboardLoanItem
              key={item.loanId}
              item={item}
              kind="overdue"
              href={`/loans/${item.loanId}${buildQueryString({
                date,
                origin: "dashboard",
                clientId: item.clientId,
              })}`}
            />
          ))}
        </div>
      ) : (
        <div className="empty-panel">No hay cartera vencida para esta fecha.</div>
      )}
    </section>
  );
}
