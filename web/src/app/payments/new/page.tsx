import Link from "next/link";
import styles from "./payments-selection.module.css";
import { getLoanDetailPageData } from "@/features/loan-detail/lib/api";
import { getPortfolio } from "@/features/portfolio/lib/api";
import { PaymentFormShell } from "@/features/payments/components/payment-form-shell";
import { PaymentLoanPickerItem } from "@/features/payments/components/payment-loan-picker-item";
import { ContextHeader } from "@/shared/components/context-header";

type SearchParams = Promise<{
  loanId?: string | string[];
  lenderId?: string | string[];
  date?: string | string[];
  mode?: string | string[];
  search?: string | string[];
  origin?: string | string[];
  clientId?: string | string[];
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

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const loanId = getSingleParam(resolvedSearchParams.loanId);
  const lenderId = getSingleParam(resolvedSearchParams.lenderId);
  const today = toDateInputValue(new Date());
  const date = clampDateInputValue(
    getSingleParam(resolvedSearchParams.date) ?? today,
    today,
  );
  const mode = getSingleParam(resolvedSearchParams.mode);
  const search = getSingleParam(resolvedSearchParams.search)?.trim() ?? "";
  const origin = getSingleParam(resolvedSearchParams.origin);
  const clientId = getSingleParam(resolvedSearchParams.clientId);
  const from = getSingleParam(resolvedSearchParams.from);
  const to = getSingleParam(resolvedSearchParams.to);
  const dashboardHref = `/${buildQueryString({ lenderId, date })}`;
  const selectionHref = `/payments/new${buildQueryString({
    lenderId,
    date,
    origin,
    clientId,
    from,
    to,
  })}`;

  if (!loanId) {
    if (!lenderId) {
      return (
        <main className="page-shell">
          <section className="panel gap-4">
            <p className="eyebrow">Registrar pago</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              Falta definir el prestamista activo.
            </h1>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Agrega <code>lenderId</code> en la URL o define el prestamista por
              defecto para poder seleccionar un prestamo.
            </p>
            <Link className="inline-link" href={dashboardHref}>
              Volver al inicio
            </Link>
          </section>
        </main>
      );
    }

    const [dueTodayResult, overdueResult, searchResult] = await Promise.all([
      getPortfolio({
        lenderId,
        date,
        status: "DUE_TODAY",
      }),
      getPortfolio({
        lenderId,
        date,
        status: "OVERDUE",
      }),
      search
        ? getPortfolio({
            lenderId,
            date,
            search,
          })
        : Promise.resolve(null),
    ]);

    if (!dueTodayResult.ok) {
      return (
        <main className="page-shell">
          <section className="panel gap-4">
            <p className="eyebrow text-[var(--danger)]">Pago no disponible</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              No pude cargar la seleccion de prestamos.
            </h1>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Verifica que el backend este corriendo en{" "}
              <code>{dueTodayResult.meta.baseUrl}</code>.
            </p>
            <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
              {dueTodayResult.error}
            </div>
            <Link className="inline-link" href={dashboardHref}>
              Volver al inicio
            </Link>
          </section>
        </main>
      );
    }

    if (!overdueResult.ok) {
      return (
        <main className="page-shell">
          <section className="panel gap-4">
            <p className="eyebrow text-[var(--danger)]">Pago no disponible</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              No pude cargar la seleccion de prestamos.
            </h1>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Verifica que el backend este corriendo en{" "}
              <code>{overdueResult.meta.baseUrl}</code>.
            </p>
            <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
              {overdueResult.error}
            </div>
            <Link className="inline-link" href={dashboardHref}>
              Volver al inicio
            </Link>
          </section>
        </main>
      );
    }

    if (searchResult && !searchResult.ok) {
      return (
        <main className="page-shell">
          <section className="panel gap-4">
            <p className="eyebrow text-[var(--danger)]">Pago no disponible</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              No pude cargar la busqueda de prestamos.
            </h1>
            <p className="text-sm leading-6 text-[var(--muted)]">
              Verifica que el backend este corriendo en{" "}
              <code>{searchResult.meta.baseUrl}</code>.
            </p>
            <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
              {searchResult.error}
            </div>
            <Link className="inline-link" href={dashboardHref}>
              Volver al inicio
            </Link>
          </section>
        </main>
      );
    }

    const selectionQuery = (selectedLoanId: string) =>
      buildQueryString({
        lenderId,
        date,
        loanId: selectedLoanId,
        origin,
        clientId,
        from,
        to,
      });

    return (
      <main className={`page-shell ${styles.pageShell}`}>
        <ContextHeader
          backHref={dashboardHref}
          backLabel="Volver al inicio"
          title="Registrar pago"
          subtitle={`Seleccion por fecha ${date}`}
          secondaryHref={`/portfolio${buildQueryString({ lenderId, date })}`}
          secondaryLabel="Cartera"
        />

        <section className={`panel ${styles.selectionPanel}`}>
          <div className={styles.selectionHeading}>
            <p className="eyebrow">Registrar pago</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              Selecciona el prestamo
            </h1>
            <p className={styles.selectionCopy}>
              Arranca el cobro desde vencimientos de hoy, atrasados o con busqueda
              por nombre del cliente.
            </p>
          </div>

          <form className={styles.controlsForm}>
            <input type="hidden" name="lenderId" value={lenderId} />
            {origin ? <input type="hidden" name="origin" value={origin} /> : null}
            {clientId ? <input type="hidden" name="clientId" value={clientId} /> : null}
            {from ? <input type="hidden" name="from" value={from} /> : null}
            {to ? <input type="hidden" name="to" value={to} /> : null}

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

            <div className={styles.controlBar}>
              <label className={styles.controlField}>
                <span className={styles.controlLabel}>Fecha de corte</span>
                <input
                  className={styles.controlInput}
                  type="date"
                  name="date"
                  defaultValue={date}
                  max={today}
                />
              </label>
              <button className={styles.controlButton} type="submit">
                Buscar
              </button>
            </div>
          </form>
        </section>

        {search ? (
          <section className={`panel ${styles.resultsSection}`}>
            <div className={styles.sectionHeading}>
              <div>
                <p className="eyebrow">Busqueda</p>
                <h2 className="section-title">Resultados por nombre</h2>
              </div>
              <p className={styles.sectionCount}>
                {searchResult?.ok ? searchResult.data.count : 0} registro(s)
              </p>
            </div>

            {searchResult?.ok && searchResult.data.items.length > 0 ? (
              <div className="space-y-3">
                {searchResult.data.items.map((item) => (
                  <PaymentLoanPickerItem
                    key={item.loanId}
                    item={item}
                    href={`/payments/new${selectionQuery(item.loanId)}`}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-panel">
                No encontre prestamos activos con ese nombre.
              </div>
            )}
          </section>
        ) : null}

        <section className={`panel ${styles.resultsSection}`}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Cobro rapido</p>
              <h2 className="section-title">Vence hoy</h2>
            </div>
            <p className={styles.sectionCount}>
              {dueTodayResult.data.count} registro(s)
            </p>
          </div>

          {dueTodayResult.data.items.length > 0 ? (
            <div className="space-y-3">
              {dueTodayResult.data.items.map((item) => (
                <PaymentLoanPickerItem
                  key={item.loanId}
                  item={item}
                  href={`/payments/new${selectionQuery(item.loanId)}`}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">
              No hay prestamos que venzan hoy para esta fecha.
            </div>
          )}
        </section>

        <section className={`panel ${styles.resultsSection}`}>
          <div className={styles.sectionHeading}>
            <div>
              <p className="eyebrow">Cobro rapido</p>
              <h2 className="section-title">Atrasados</h2>
            </div>
            <p className={styles.sectionCount}>
              {overdueResult.data.count} registro(s)
            </p>
          </div>

          {overdueResult.data.items.length > 0 ? (
            <div className="space-y-3">
              {overdueResult.data.items.map((item) => (
                <PaymentLoanPickerItem
                  key={item.loanId}
                  item={item}
                  href={`/payments/new${selectionQuery(item.loanId)}`}
                />
              ))}
            </div>
          ) : (
            <div className="empty-panel">No hay cartera atrasada para esta fecha.</div>
          )}
        </section>
      </main>
    );
  }

  const loanDataResult = await getLoanDetailPageData({
    loanId,
    date,
  });

  if (!loanDataResult.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Pago no disponible</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar el contexto del prestamo.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{loanDataResult.meta.baseUrl}</code>.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {loanDataResult.error}
          </div>
        </section>
      </main>
    );
  }

  const loanDetailHref = `/loans/${loanId}${buildQueryString({
    lenderId,
    date,
    origin,
    clientId,
    from,
    to,
  })}`;

  const usesSelectionFlow =
    origin === "dashboard-payment" || origin === "global-payment";

  return (
    <PaymentFormShell
      loanData={loanDataResult.data}
      initialDate={date}
      backHref={usesSelectionFlow ? selectionHref : loanDetailHref}
      loanDetailHref={loanDetailHref}
      selectionHref={usesSelectionFlow ? selectionHref : undefined}
      dashboardHref={dashboardHref}
      initialMode={
        mode === "PRORATED_BY_DAYS" || mode === "FULL_MONTH"
          ? mode
          : undefined
      }
    />
  );
}
