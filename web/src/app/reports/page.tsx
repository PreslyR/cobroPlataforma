import { ClosedLoanItem } from "@/features/reports/components/closed-loan-item";
import { ReportPaymentItem } from "@/features/reports/components/report-payment-item";
import { getReportsPageData } from "@/features/reports/lib/api";
import { formatCurrency, formatLongDate } from "@/shared/lib/format";
import styles from "./reports.module.css";

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

function formatRangeLabel(from: string, to: string) {
  if (from === to) {
    return formatLongDate(to);
  }

  return `${formatLongDate(from)} | ${formatLongDate(to)}`;
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
      <main className={`page-shell ${styles.pageShell}`}>
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
      <main className={`page-shell ${styles.pageShell}`}>
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
    <main className={`page-shell ${styles.pageShell}`}>
      <section className={styles.hero}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Reportes</p>
            <h1 className={styles.heroTitle}>Historico del negocio</h1>
            <p className={styles.heroSubtitle}>
              Consulta ingresos del periodo, foto de cartera y prestamos ya cerrados.
            </p>
          </div>
          <div className={styles.heroRange}>
            <p className={styles.heroRangeLabel}>Rango</p>
            <p className={styles.heroRangeValue}>{formatRangeLabel(from, to)}</p>
          </div>
        </div>

        <div className={styles.metricsPanel}>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Recaudo total</p>
            <p className={styles.metricValue}>
              {formatCurrency(interestIncome.totalCollectedAmount)}
            </p>
            <p className={styles.metricMeta}>{interestIncome.paymentsCount} pago(s)</p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Intereses cobrados</p>
            <p className={styles.metricValue}>
              {formatCurrency(interestIncome.totalInterestIncome)}
            </p>
            <p className={styles.metricMeta}>Dentro del rango</p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Mora cobrada</p>
            <p className={styles.metricValue}>
              {formatCurrency(penaltyIncome.totalPenaltyIncome)}
            </p>
            <p className={styles.metricMeta}>Dentro del rango</p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Prestamos cerrados</p>
            <p className={styles.metricValue}>{String(closedLoans.totalCount)}</p>
            <p className={styles.metricMeta}>Cierres del periodo</p>
          </div>
        </div>
      </section>

      <section className={`panel ${styles.controlsPanel}`}>
        <div className={styles.controlsHeading}>
          <p className="eyebrow">Rango del reporte</p>
          <p className={styles.controlsCopy}>
            Ajusta el periodo para revisar ingresos, pagos y cierres del negocio.
          </p>
        </div>

        <form className={styles.controlsForm}>
          <input type="hidden" name="lenderId" defaultValue={lenderId} />
          <div className={styles.controlBar}>
            <label className={styles.controlField}>
              <span className={styles.controlLabel}>Desde</span>
              <input
                className={styles.controlInput}
                type="date"
                name="from"
                defaultValue={from}
                max={todayInput}
              />
            </label>
            <label className={styles.controlField}>
              <span className={styles.controlLabel}>Hasta</span>
              <input
                className={styles.controlInput}
                type="date"
                name="to"
                defaultValue={to}
                max={todayInput}
              />
            </label>
            <button className={styles.controlButton} type="submit">
              Aplicar
            </button>
          </div>
        </form>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Cartera al corte</p>
            <h2 className="section-title">Foto actual del negocio</h2>
          </div>
          <p className={styles.sectionNote}>
            Corte operativo del {formatLongDate(portfolioSummary.asOfDate)}
          </p>
        </div>

        <div className={styles.metricsPanel}>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Activos</p>
            <p className={styles.metricValue}>{String(portfolioSummary.totals.activeLoans)}</p>
            <p className={styles.metricMeta}>
              {portfolioSummary.totals.overdueLoans} atrasado(s)
            </p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Capital pendiente</p>
            <p className={styles.metricValue}>
              {formatCurrency(portfolioSummary.totals.capitalPending)}
            </p>
            <p className={styles.metricMeta}>
              Colocado {formatCurrency(portfolioSummary.totals.principalPlaced)}
            </p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Pendiente total</p>
            <p className={styles.metricValue}>
              {formatCurrency(portfolioSummary.totals.pendingTotal)}
            </p>
            <p className={styles.metricMeta}>Capital + interes + mora</p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Interes pendiente</p>
            <p className={styles.metricValue}>
              {formatCurrency(portfolioSummary.totals.interestPending)}
            </p>
            <p className={styles.metricMeta}>Aun no cobrado</p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Mora pendiente</p>
            <p className={styles.metricValue}>
              {formatCurrency(portfolioSummary.totals.penaltyPending)}
            </p>
            <p className={styles.metricMeta}>Mora acumulada</p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Cobrable hoy</p>
            <p className={styles.metricValue}>
              {formatCurrency(portfolioSummary.totals.totalCollectibleToday)}
            </p>
            <p className={styles.metricMeta}>
              Vencido {formatCurrency(portfolioSummary.totals.overdueAmount)}
            </p>
          </div>
        </div>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Historial</p>
            <h2 className="section-title">Pagos del periodo</h2>
          </div>
          <p className={styles.sectionNote}>{paymentsHistory.totalCount} registro(s)</p>
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

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Cierres</p>
            <h2 className="section-title">Prestamos cerrados</h2>
          </div>
          <p className={styles.sectionNote}>{closedLoans.totalCount} registro(s)</p>
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