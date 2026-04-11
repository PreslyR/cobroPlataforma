import Link from "next/link";
import { PortfolioLoanCard } from "@/features/portfolio/components/portfolio-loan-card";
import { getPortfolio } from "@/features/portfolio/lib/api";
import { formatLongDate } from "@/shared/lib/format";
import styles from "./portfolio.module.css";

type SearchParams = Promise<{
  date?: string | string[];
  lenderId?: string | string[];
  status?: string | string[];
  type?: string | string[];
  search?: string | string[];
}>;

const statusFilters = [
  { value: "ALL", label: "Todos" },
  { value: "DUE_TODAY", label: "Hoy" },
  { value: "OVERDUE", label: "Atrasados" },
  { value: "CURRENT", label: "Al dia" },
] as const;

const typeFilters = [
  { value: "ALL", label: "Todos" },
  { value: "FIXED_INSTALLMENTS", label: "Cuotas fijas" },
  { value: "MONTHLY_INTEREST", label: "Interes mensual" },
] as const;

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

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      className={`filter-chip ${active ? "filter-chip-active" : ""}`}
      href={href}
    >
      {label}
    </Link>
  );
}

export default async function PortfolioPage({
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
  const status = getSingleParam(resolvedSearchParams.status) ?? "ALL";
  const type = getSingleParam(resolvedSearchParams.type) ?? "ALL";
  const search = getSingleParam(resolvedSearchParams.search) ?? "";
  const detailQueryString = buildQueryString({ lenderId, date, origin: "portfolio" });

  if (!lenderId) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow">Configuracion inicial</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            Falta definir el prestamista activo.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Para usar la cartera, agrega <code>lenderId</code> en la URL o define
            <code>NEXT_PUBLIC_DEFAULT_LENDER_ID</code> en <code>web/.env.local</code>.
          </p>
        </section>
      </main>
    );
  }

  const portfolio = await getPortfolio({
    lenderId,
    date,
    status,
    type,
    search,
  });

  if (!portfolio.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Cartera no disponible</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar la cartera activa.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{portfolio.meta.baseUrl}</code> y que el prestamista tenga datos.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {portfolio.error}
          </div>
        </section>
      </main>
    );
  }

  const { summary, items } = portfolio.data;

  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Cartera</p>
            <h1 className={styles.heroTitle}>Prestamos activos</h1>
            <p className={styles.heroSubtitle}>
              Lista operativa para encontrar rapido quien requiere gestion hoy.
            </p>
          </div>

          <div className={styles.heroDate}>
            <p className={styles.heroDateLabel}>Fecha de corte</p>
            <p className={styles.heroDateValue}>
              {formatLongDate(portfolio.data.date)}
            </p>
          </div>
        </div>

        <div className={styles.summaryStrip}>
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>Activos</span>
            <strong className={styles.summaryValue}>{summary.activeLoans}</strong>
          </div>
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>Hoy</span>
            <strong className={styles.summaryValue}>{summary.dueTodayLoans}</strong>
          </div>
          <div className={styles.summaryCell}>
            <span className={styles.summaryLabel}>Atrasados</span>
            <strong className={styles.summaryValue}>{summary.overdueLoans}</strong>
          </div>
        </div>
      </section>

      <section className={styles.controlsPanel}>
        <div className={styles.controlsHeading}>
          <p className="eyebrow">Filtros</p>
          <p className={styles.controlsCopy}>
            Busca rapido y ajusta el corte de la cartera.
          </p>
        </div>

        <form className={styles.controlsForm}>
          <input type="hidden" name="lenderId" value={lenderId} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="type" value={type} />

          <label className="surface-field">
            <span className="surface-label">Buscar cliente</span>
            <input
              className="surface-input"
              type="search"
              name="search"
              placeholder="Nombre del cliente"
              defaultValue={search}
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

      <section className={`panel ${styles.filtersPanel}`}>
        <div className={styles.filterGroup}>
          <p className={styles.filterGroupLabel}>Filtro operativo</p>
          <div className={styles.chipsRow}>
            {statusFilters.map((filter) => (
              <FilterLink
                key={filter.value}
                label={filter.label}
                active={status === filter.value}
                href={`/portfolio${buildQueryString({
                  lenderId,
                  date,
                  type,
                  status: filter.value,
                  search,
                })}`}
              />
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <p className={styles.filterGroupLabel}>Tipo de prestamo</p>
          <div className={styles.chipsRow}>
            {typeFilters.map((filter) => (
              <FilterLink
                key={filter.value}
                label={filter.label}
                active={type === filter.value}
                href={`/portfolio${buildQueryString({
                  lenderId,
                  date,
                  status,
                  type: filter.value,
                  search,
                })}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className={`panel ${styles.resultsSection}`}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Listado</p>
            <h2 className="section-title">Resultados</h2>
          </div>
          <p className={styles.sectionNote}>{summary.visibleLoans} prestamo(s)</p>
        </div>

        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <PortfolioLoanCard
                key={item.loanId}
                item={item}
                queryString={detailQueryString}
              />
            ))}
          </div>
        ) : search ? (
          <div className="empty-panel">
            No encontre prestamos activos para la busqueda actual.
          </div>
        ) : (
          <div className="empty-panel">
            No hay prestamos activos para este conjunto de filtros.
          </div>
        )}
      </section>
    </main>
  );
}

