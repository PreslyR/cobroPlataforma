import { ClientPortfolioCard } from "@/features/clients/components/client-portfolio-card";
import { getClientsPortfolio } from "@/features/clients/lib/api";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { formatCurrency, formatLongDate } from "@/shared/lib/format";

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
  const reportsQueryString = buildQueryString({
    lenderId,
    from: getMonthStartInputValue(date),
    to: date,
  });

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
    <main className="page-shell">
        <section className="panel gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="eyebrow">Clientes</p>
              <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
                Vista por persona
              </h1>
              <p className="max-w-[28rem] text-sm leading-6 text-[var(--muted)]">
                Cada cliente se muestra una sola vez, con su deuda operativa agregada
                y acceso a su ficha consolidada.
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

          <form className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
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
              <span className="surface-label">Buscar por nombre</span>
              <input
                className="surface-input"
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Ej. Juan Perez"
              />
            </label>
            <input type="hidden" name="lenderId" value={lenderId} />
            <button className="surface-button" type="submit">
              Buscar
            </button>
          </form>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Con prestamos"
            value={String(summary.clientsWithActiveLoans)}
            meta={`${items.length} visible(s)`}
            tone="neutral"
          />
          <MetricCard
            label="Con atraso"
            value={String(summary.clientsWithOverdueLoans)}
            meta={formatCurrency(summary.totalCollectibleToday)}
            tone="danger"
          />
          <MetricCard
            label="Cobrable hoy"
            value={formatCurrency(summary.totalCollectibleToday)}
            meta={`Fecha ${date}`}
            tone="brand"
          />
          <MetricCard
            label="Busqueda"
            value={search ? `"${search}"` : "Todas"}
            meta="Filtro por nombre"
            tone="warning"
          />
        </section>

        <section className="panel gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Listado</p>
              <h2 className="section-title">Clientes activos</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">{items.length} registro(s)</p>
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
