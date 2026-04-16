import { DashboardLoanItem } from "@/features/dashboard/components/dashboard-loan-item";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { getDashboardToday } from "@/features/dashboard/lib/api";
import { formatCurrency, formatLongDate } from "@/shared/lib/format";
import styles from "./home.module.css";

type SearchParams = Promise<{
  date?: string | string[];
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
  const today = toDateInputValue(new Date());
  const date = clampDateInputValue(
    getSingleParam(resolvedSearchParams.date) ?? today,
    today,
  );
  const queryString = buildQueryString({ date });

  const dashboard = await getDashboardToday({ date });

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
            <code>{dashboard.meta.baseUrl}</code> y que tu sesion tenga un usuario
            interno valido.
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
    <main className={`page-shell ${styles.pageShellHome}`} id="top">
      <section className={styles.homeHeroBand}>
        <div className={styles.homeHero}>
          <div className={styles.homeHeroCopy}>
            <h1 className={styles.homeTitle}>
              Hola{dashboard.data.lenderName ? `, ${dashboard.data.lenderName}` : ""}
            </h1>
            <p className={styles.homeSubtitle}>
              Cobrable hoy y cartera por atender.
            </p>
          </div>

          <div className={styles.homeHeroAccent} aria-hidden="true">
            <span
              className={`${styles.homeHeroAccentStroke} ${styles.homeHeroAccentStrokeBrand}`}
            />
            <span
              className={`${styles.homeHeroAccentStroke} ${styles.homeHeroAccentStrokeSun}`}
            />
            <span
              className={`${styles.homeHeroAccentStroke} ${styles.homeHeroAccentStrokeSky}`}
            />
          </div>
        </div>
      </section>

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

      <section className={styles.homeToolbarPanel}>
        <div className={styles.homeToolbarHeading}>
          <p className="eyebrow">Fecha de corte</p>
          <p className={styles.homeToolbarCopy}>Ajusta el dia de consulta.</p>
        </div>

        <form className={styles.homeToolbarGrid}>
          <label className={styles.homeControlField}>
            <span className={styles.homeControlLabel}>Fecha de corte</span>
            <input
              className={styles.homeControlInput}
              type="date"
              name="date"
              defaultValue={date}
              max={today}
            />
          </label>
          <button className={styles.homeControlButton} type="submit">
            Actualizar
          </button>
        </form>
      </section>

      <section className={styles.homeSectionBlock} id="due-today">
        <div className={styles.homeSectionHeading}>
          <div>
            <p className="eyebrow">Cobros de hoy</p>
            <h2 className="section-title">Vencen hoy</h2>
          </div>
          <p className={styles.homeSectionNote}>
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

      <section className={styles.homeSectionBlock} id="overdue">
        <div className={styles.homeSectionHeading}>
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2 className="section-title">Atrasados</h2>
          </div>
          <p className={styles.homeSectionNote}>Cobro que requiere atencion</p>
        </div>

        {sections.overdue.length > 0 ? (
          <div className="space-y-3">
            {sections.overdue.map((item) => (
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
          <div className="empty-panel">
            No hay cartera vencida para esta fecha.
          </div>
        )}
      </section>
    </main>
  );
}
