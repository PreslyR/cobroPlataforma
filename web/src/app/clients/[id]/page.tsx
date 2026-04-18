import Link from "next/link";
import { ClientDetailHero } from "@/features/clients/components/client-detail-hero";
import { ClientLoanItem } from "@/features/clients/components/client-loan-item";
import { ClientPaymentItem } from "@/features/clients/components/client-payment-item";
import { getClientDebt } from "@/features/clients/lib/api";
import { ContextHeader } from "@/shared/components/context-header";
import {
  formatCurrency,
  formatDateShort,
  formatLoanStatus,
  formatLoanType,
  formatLongDate,
} from "@/shared/lib/format";
import styles from "./client-detail.module.css";

type ClientDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    lenderId?: string | string[];
    date?: string | string[];
    origin?: string | string[];
    loanId?: string | string[];
    loanOrigin?: string | string[];
    from?: string | string[];
    to?: string | string[];
  }>;
};

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

export default async function ClientDetailPage({
  params,
  searchParams,
}: ClientDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const today = toDateInputValue(new Date());
  const date = clampDateInputValue(
    getSingleParam(resolvedSearchParams.date) ?? today,
    today,
  );
  const origin = getSingleParam(resolvedSearchParams.origin);
  const loanId = getSingleParam(resolvedSearchParams.loanId);
  const loanOrigin = getSingleParam(resolvedSearchParams.loanOrigin);
  const from = getSingleParam(resolvedSearchParams.from);
  const to = getSingleParam(resolvedSearchParams.to);
  const queryString = buildQueryString({ date });
  const loanDetailQueryString = buildQueryString({

    date,
    origin: loanOrigin,
    clientId: id,
    from,
    to,
  });
  const backHref =
    origin === "loan-detail" && loanId
      ? `/loans/${loanId}${loanDetailQueryString}`
      : `/clients${queryString}`;
  const backLabel =
    origin === "loan-detail" && loanId
      ? "Volver al prestamo"
      : "Volver a clientes";
  const secondaryHref =
    origin === "loan-detail" && loanId ? `/clients${queryString}` : `/portfolio${queryString}`;
  const secondaryLabel = origin === "loan-detail" && loanId ? "Clientes" : "Cartera";

  const clientDebtResult = await getClientDebt({
    clientId: id,
    asOf: date,
  });

  if (!clientDebtResult.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Cliente no disponible</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar la ficha del cliente.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{clientDebtResult.meta.baseUrl}</code>.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {clientDebtResult.error}
          </div>
          <Link className="inline-link" href={backHref}>
            {backLabel}
          </Link>
        </section>
      </main>
    );
  }

  const { client, summary, activeLoans, closedLoans, recentPayments, asOfDate } =
    clientDebtResult.data;

  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <ContextHeader
        backHref={backHref}
        backLabel={backLabel}
        title="Cliente"
        subtitle={`C.C. ${client.documentNumber}`}
        secondaryHref={secondaryHref}
        secondaryLabel={secondaryLabel}
      />

      <ClientDetailHero
        fullName={client.fullName}
        documentNumber={client.documentNumber}
        email={client.email}
        phone={client.phone}
        lenderName={client.lender.name}
        address={client.address}
        notes={client.notes}
        dateLabel={formatLongDate(asOfDate)}
      />

      <section className={styles.controlsPanel}>
        <div className={styles.controlsHeading}>
          <p className="eyebrow">Corte</p>
          <p className={styles.controlsCopy}>
            Ajusta la fecha para revisar la posicion operativa del cliente.
          </p>
        </div>

        <form className={styles.controlsForm}>
          {origin ? <input type="hidden" name="origin" value={origin} /> : null}
          {loanId ? <input type="hidden" name="loanId" value={loanId} /> : null}
          {loanOrigin ? (
            <input type="hidden" name="loanOrigin" value={loanOrigin} />
          ) : null}
          {from ? <input type="hidden" name="from" value={from} /> : null}
          {to ? <input type="hidden" name="to" value={to} /> : null}
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
        </form>
      </section>

      <section className={styles.summaryGrid}>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Cobrable hoy</span>
          <strong className={styles.summaryValue}>
            {formatCurrency(summary.totalCollectibleToday)}
          </strong>
        </div>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Saldo pendiente</span>
          <strong className={styles.summaryValue}>
            {formatCurrency(summary.outstandingBalance)}
          </strong>
        </div>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Prestamos activos</span>
          <strong className={styles.summaryValue}>{summary.activeLoansCount}</strong>
        </div>
        <div className={styles.summaryCell}>
          <span className={styles.summaryLabel}>Mora pendiente</span>
          <strong className={styles.summaryValue}>
            {formatCurrency(summary.penaltyPending)}
          </strong>
        </div>
      </section>

      <section className={`panel ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Prestamos activos</p>
            <h2 className="section-title">Operacion actual</h2>
          </div>
          <p className={styles.sectionCount}>{activeLoans.length} registro(s)</p>
        </div>

        {activeLoans.length > 0 ? (
          <div className="space-y-3">
            {activeLoans.map((item) => (
              <ClientLoanItem
                key={item.loanId}
                item={item}
                href={`/loans/${item.loanId}${buildQueryString({
              
                  date,
                  origin: "client-detail",
                  clientId: id,
                })}`}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            Este cliente no tiene prestamos activos en este momento.
          </div>
        )}
      </section>

      <section className={`panel ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Pagos recientes</p>
            <h2 className="section-title">Movimiento del cliente</h2>
          </div>
          <p className={styles.sectionCount}>{recentPayments.length} registro(s)</p>
        </div>

        {recentPayments.length > 0 ? (
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <ClientPaymentItem
                key={payment.id}
                item={payment}
                href={`/loans/${payment.loanId}${buildQueryString({
              
                  date,
                  origin: "client-detail",
                  clientId: id,
                })}`}
              />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            Este cliente todavia no tiene pagos registrados.
          </div>
        )}
      </section>

      <section className={`panel ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Prestamos cerrados</p>
            <h2 className="section-title">Historial del cliente</h2>
          </div>
          <p className={styles.sectionCount}>{closedLoans.length} registro(s)</p>
        </div>

        {closedLoans.length > 0 ? (
          <div className="space-y-3">
            {closedLoans.map((loan) => (
              <article key={loan.loanId} className={styles.closedLoanCard}>
                <div className={styles.closedLoanHead}>
                  <div className={styles.closedLoanCopy}>
                    <p className={styles.closedLoanName}>{formatLoanType(loan.type)}</p>
                    <p className={styles.closedLoanMeta}>
                      {formatLoanStatus(loan.status)} | Cerrado {formatDateShort(loan.closedAt)}
                    </p>
                  </div>
                  <span className={styles.closedLoanBadge}>
                    {loan.wasEarlySettlement ? "Anticipado" : "Cerrado"}
                  </span>
                </div>

                <div className={styles.closedLoanStats}>
                  <div className={styles.closedLoanStat}>
                    <span className={styles.closedLoanStatLabel}>Monto original</span>
                    <strong className={styles.closedLoanStatValue}>
                      {formatCurrency(loan.principalAmount)}
                    </strong>
                  </div>
                  <div className={styles.closedLoanStat}>
                    <span className={styles.closedLoanStatLabel}>Ultimo pago</span>
                    <strong className={styles.closedLoanStatValue}>
                      {formatCurrency(loan.lastPaymentAmount)}
                    </strong>
                  </div>
                </div>

                <div className={styles.closedLoanFooter}>
                  <span className={styles.closedLoanId}>{loan.loanId.slice(0, 8)}</span>
                  <Link
                    className={styles.closedLoanCta}
                    href={`/loans/${loan.loanId}${buildQueryString({
                  
                      date,
                      origin: "client-detail",
                      clientId: id,
                    })}`}
                  >
                    Ver prestamo
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            Todavia no hay prestamos cerrados para este cliente.
          </div>
        )}
      </section>
    </main>
  );
}



