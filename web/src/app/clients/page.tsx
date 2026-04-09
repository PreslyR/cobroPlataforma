import { ClientPortfolioCard } from "@/features/clients/components/client-portfolio-card";
import { getClientsPortfolio } from "@/features/clients/lib/api";
import { formatCurrency, formatLongDate } from "@/shared/lib/format";
import styles from "./clients.module.css";

type SearchParams = Promise<{
  lenderId?: string | string[];
  date?: string | string[];
  search?: string | string[];
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

export default async function ClientsPage({
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
  const search = getSingleParam(resolvedSearchParams.search)?.trim() ?? "";
  const baseQueryString = buildQueryString({ lenderId, date });

  if (!lenderId) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow">Clientes</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            Falta definir el prestamista activo.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Agrega <code>lenderId</code> en la URL o define el prestamista por
            defecto para abrir la vista de clientes.
          </p>
        </section>
      </main>
    );
  }

  const clientsResult = await getClientsPortfolio({
    lenderId,
    asOf: date,
    search,
  });

  if (!clientsResult.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Clientes no disponibles</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar el resumen de clientes.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{clientsResult.meta.baseUrl}</code>.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {clientsResult.error}
          </div>
        </section>
      </main>
    );
  }

  const { summary, items, asOfDate } = clientsResult.data;

  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Clientes</p>
            <h1 className={styles.heroTitle}>Vista por persona</h1>
            <p className={styles.heroSubtitle}>
              Cada cliente aparece una sola vez con su deuda agregada y acceso rapido
              a su ficha consolidada.
            </p>
          </div>

          <div className={styles.heroDate}>
            <p className={styles.heroDateLabel}>Fecha de corte</p>
            <p className={styles.heroDateValue}>{formatLongDate(asOfDate)}</p>
          </div>
        </div>
      </section>

      <section className={styles.controlsPanel}>
        <div className={styles.controlsHeading}>
          <p className="eyebrow">Filtros</p>
          <p className={styles.controlsCopy}>
            Busca por nombre y ajusta el corte de la cartera por cliente.
          </p>
        </div>

        <form className={styles.controlsForm}>
          <input type="hidden" name="lenderId" value={lenderId} />
          <label className="surface-field">
            <span className="surface-label">Buscar cliente</span>
            <input
              className="surface-input"
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Nombre del cliente"
            />
          </label>

          <div className={styles.controlsBottomRow}>
            <label className="surface-field">
              <span className="surface-label">Fecha</span>
              <input
                className="surface-input"
                type="date"
                name="date"
                defaultValue={date}
                max={today}
              />
            </label>
            <button className="surface-button" type="submit">
              Aplicar
            </button>
          </div>
        </form>
      </section>

      <section className={styles.summaryStrip}>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Activos</span>
          <strong className={styles.summaryValue}>
            {summary.clientsWithActiveLoans}
          </strong>
        </div>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Con atraso</span>
          <strong className={styles.summaryValue}>
            {summary.clientsWithOverdueLoans}
          </strong>
        </div>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Cobrable hoy</span>
          <strong className={styles.summaryValue}>
            {formatCurrency(summary.totalCollectibleToday)}
          </strong>
        </div>
      </section>

      <section className={`panel ${styles.resultsSection}`}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Listado</p>
            <h2 className="section-title">Clientes activos</h2>
          </div>
          <p className={styles.sectionNote}>{items.length} registro(s)</p>
        </div>

        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <ClientPortfolioCard
                key={item.clientId}
                item={item}
                href={`/clients/${item.clientId}${baseQueryString}`}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            No hay clientes con prestamos activos para esta fecha o filtro.
          </div>
        )}
      </section>
    </main>
  );
}
