import Link from "next/link";
import { ClientIntakeCard } from "@/features/clients/components/client-intake-card";
import { ClientPortfolioCard } from "@/features/clients/components/client-portfolio-card";
import {
  getClientsPortfolio,
  getPendingClientIntakeSubmissions,
} from "@/features/clients/lib/api";
import { formatCurrency, formatLongDate } from "@/shared/lib/format";
import styles from "./clients.module.css";

type SearchParams = Promise<{
  date?: string | string[];
  search?: string | string[];
  tab?: string | string[];
  intakeNotice?: string | string[];
  intakeError?: string | string[];
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
  const today = toDateInputValue(new Date());
  const date = clampDateInputValue(
    getSingleParam(resolvedSearchParams.date) ?? today,
    today,
  );
  const search = getSingleParam(resolvedSearchParams.search)?.trim() ?? "";
  const activeTab =
    getSingleParam(resolvedSearchParams.tab)?.trim() === "pending"
      ? "pending"
      : "clients";
  const intakeNotice = getSingleParam(resolvedSearchParams.intakeNotice)?.trim();
  const intakeError = getSingleParam(resolvedSearchParams.intakeError)?.trim();
  const baseQueryString = buildQueryString({
    date,
    ...(activeTab === "pending" ? { tab: "pending" } : {}),
  });
  const clientsTabQuery = buildQueryString({ date });
  const pendingTabQuery = buildQueryString({ date, tab: "pending" });

  const clientsResult =
    activeTab === "clients"
      ? await getClientsPortfolio({
          asOf: date,
          search,
        })
      : null;
  const intakeResult =
    activeTab === "pending" ? await getPendingClientIntakeSubmissions() : null;

  if (activeTab === "clients" && clientsResult && !clientsResult.ok) {
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

  if (activeTab === "pending" && intakeResult && !intakeResult.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Pendientes no disponibles</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar las solicitudes pendientes.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{intakeResult.meta.baseUrl}</code>.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {intakeResult.error}
          </div>
        </section>
      </main>
    );
  }

  const { summary, items, asOfDate } =
    clientsResult?.ok
      ? clientsResult.data
      : {
          summary: {
            clientsWithActiveLoans: 0,
            clientsWithOverdueLoans: 0,
            totalCollectibleToday: 0,
          },
          items: [],
          asOfDate: date,
        };
  const pendingItems = intakeResult?.ok ? intakeResult.data : [];

  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Clientes</p>
            <h1 className={styles.heroTitle}>Vista por persona</h1>
            <p className={styles.heroSubtitle}>
              {activeTab === "pending"
                ? "Revisa solicitudes recibidas por formulario antes de convertirlas en clientes reales."
                : "Cada cliente aparece una sola vez con su deuda agregada y acceso rapido a su ficha consolidada."}
            </p>
          </div>

          <div className={styles.heroDate}>
            <p className={styles.heroDateLabel}>Fecha de corte</p>
            <p className={styles.heroDateValue}>{formatLongDate(asOfDate)}</p>
          </div>
        </div>
      </section>

      <section className={styles.tabStrip} aria-label="Vista de clientes">
        <Link
          className={`${styles.tabButton} ${
            activeTab === "clients" ? styles.tabButtonActive : ""
          }`}
          href={clientsTabQuery || "/clients"}
        >
          Clientes
        </Link>
        <Link
          className={`${styles.tabButton} ${
            activeTab === "pending" ? styles.tabButtonActive : ""
          }`}
          href={pendingTabQuery || "/clients?tab=pending"}
        >
          Pendientes
          {pendingItems.length > 0 ? (
            <span className={styles.tabCount}>{pendingItems.length}</span>
          ) : null}
        </Link>
      </section>

      {intakeNotice ? (
        <section className={styles.noticeBanner}>{intakeNotice}</section>
      ) : null}

      {intakeError ? (
        <section className={styles.errorBanner}>{intakeError}</section>
      ) : null}

      {activeTab === "clients" ? (
        <>
          <section className={styles.controlsPanel}>
            <div className={styles.controlsHeading}>
              <p className="eyebrow">Filtros</p>
              <p className={styles.controlsCopy}>
                Busca por nombre y ajusta el corte de la cartera por cliente.
              </p>
            </div>

            <form className={styles.controlsForm}>
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
                <label className={styles.controlField}>
                  <span className={styles.controlLabel}>Fecha</span>
                  <input
                    className={styles.controlInput}
                    type="date"
                    name="date"
                    defaultValue={date}
                    max={today}
                  />
                </label>
                <button className={styles.controlButton} type="submit">
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
        </>
      ) : (
        <section className={`panel ${styles.resultsSection}`}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Pendientes</p>
              <h2 className="section-title">Solicitudes por revisar</h2>
            </div>
            <p className={styles.sectionNote}>{pendingItems.length} registro(s)</p>
          </div>

          {pendingItems.length > 0 ? (
            <div className="space-y-3">
              {pendingItems.map((item) => (
                <ClientIntakeCard
                  key={item.id}
                  item={item}
                  date={date}
                  search={search}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              No hay solicitudes pendientes por revisar en este momento.
            </div>
          )}
        </section>
      )}
    </main>
  );
}
