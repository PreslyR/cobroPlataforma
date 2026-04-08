import Link from "next/link";
import { PortfolioLoanCard } from "@/features/portfolio/components/portfolio-loan-card";
import { getPortfolio } from "@/features/portfolio/lib/api";
import { formatLongDate } from "@/shared/lib/format";

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

function getMonthStartInputValue(value: string) {
  return `${value.slice(0, 7)}-01`;
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
  const detailQueryString = buildQueryString({ lenderId, date });
  const reportsQueryString = buildQueryString({
    lenderId,
    from: getMonthStartInputValue(date),
    to: date,
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
    <main className="page-shell">
        <section className="panel gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="eyebrow">Cartera</p>
              <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                Prestamos activos
              </h1>
              <p className="max-w-[22rem] text-sm leading-6 text-[var(--muted)]">
                Lista operativa para encontrar rapido quien requiere gestion hoy.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="summary-pill">
              <span className="summary-pill-label">Activos</span>
              <strong>{summary.activeLoans}</strong>
            </div>
            <div className="summary-pill">
              <span className="summary-pill-label">Hoy</span>
              <strong>{summary.dueTodayLoans}</strong>
            </div>
            <div className="summary-pill">
              <span className="summary-pill-label">Atrasados</span>
              <strong>{summary.overdueLoans}</strong>
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
            Fecha de corte:{" "}
            <strong className="text-[var(--foreground)]">
              {formatLongDate(portfolio.data.date)}
            </strong>
          </div>
        </section>

        <section className="panel gap-4">
          <form className="flex flex-col gap-3">
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

            <div className="grid grid-cols-[1fr_auto] gap-3">
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

        <section className="panel gap-4">
          <div className="space-y-3">
            <div>
              <p className="eyebrow">Filtro operativo</p>
              <div className="mt-2 flex flex-wrap gap-2">
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

            <div>
              <p className="eyebrow">Tipo de prestamo</p>
              <div className="mt-2 flex flex-wrap gap-2">
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
          </div>
        </section>

        <section className="panel gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Listado</p>
              <h2 className="section-title">Resultados</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {summary.visibleLoans} prestamo(s)
            </p>
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
