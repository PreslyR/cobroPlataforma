import Link from "next/link";
import { DetailMetricCard } from "@/features/loan-detail/components/detail-metric-card";
import { InstallmentItem } from "@/features/loan-detail/components/installment-item";
import { LoanDetailHero } from "@/features/loan-detail/components/loan-detail-hero";
import { LoanActionCard } from "@/features/loan-detail/components/loan-action-card";
import { RecentPaymentItem } from "@/features/loan-detail/components/recent-payment-item";
import { ScrollAwareActionBar } from "@/features/loan-detail/components/scroll-aware-action-bar";
import { getLoanDetailPageData } from "@/features/loan-detail/lib/api";
import { ContextHeader } from "@/shared/components/context-header";
import styles from "./loan-detail-page.module.css";
import {
  formatCurrency,
  formatDateShort,
  formatInstallmentStatus,
  formatLoanStatus,
  formatLoanType,
  formatLongDate,
  formatPaymentFrequency,
  formatPercentage,
  formatSettlementMode,
} from "@/shared/lib/format";

type LoanDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    lenderId?: string | string[];
    date?: string | string[];
    origin?: string | string[];
    clientId?: string | string[];
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

function getOperationalStatusLabel(values: {
  status: string;
  overdue: boolean;
  dueToday: boolean;
}) {
  if (values.status === "PAID") {
    return "Pagado";
  }

  if (values.overdue) {
    return "Atrasado";
  }

  if (values.dueToday) {
    return "Hoy";
  }

  return "Al dia";
}

function getOperationalTone(values: {
  status: string;
  overdue: boolean;
  dueToday: boolean;
}) {
  if (values.status === "PAID") {
    return "bg-[var(--success-soft)] text-[var(--success)]";
  }

  if (values.overdue) {
    return "bg-[var(--danger-soft)] text-[var(--danger)]";
  }

  if (values.dueToday) {
    return "bg-[var(--warning-soft)] text-[var(--warning)]";
  }

  return "bg-[var(--brand-soft)] text-[var(--brand)]";
}

export default async function LoanDetailPage({
  params,
  searchParams,
}: LoanDetailPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const lenderId = getSingleParam(resolvedSearchParams.lenderId);
  const today = toDateInputValue(new Date());
  const date = clampDateInputValue(
    getSingleParam(resolvedSearchParams.date) ?? today,
    today,
  );
  const origin = getSingleParam(resolvedSearchParams.origin);
  const clientIdParam = getSingleParam(resolvedSearchParams.clientId);
  const from = getSingleParam(resolvedSearchParams.from);
  const to = getSingleParam(resolvedSearchParams.to);
  const backQueryString = buildQueryString({ lenderId, date });
  const reportsBackQueryString = buildQueryString({ lenderId, from, to });
  const loanBundle = await getLoanDetailPageData({
    loanId: id,
    date,
  });

  if (!loanBundle.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Prestamo no disponible</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar la ficha operativa.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{loanBundle.meta.baseUrl}</code>.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {loanBundle.error}
          </div>
          <Link className="inline-link" href={`/portfolio${backQueryString}`}>
            Volver a cartera
          </Link>
        </section>
      </main>
    );
  }

  const { loan, debtBreakdown, summary, payoffFullMonth, payoffProrated } =
    loanBundle.data;
  const clientId = clientIdParam ?? loan.clientId;
  const paymentQueryString = buildQueryString({
    lenderId,
    date,
    loanId: id,
    origin,
    clientId,
    from,
    to,
  });
  const operationalLabel = getOperationalStatusLabel({
    status: loan.status,
    overdue: debtBreakdown.overdue,
    dueToday: debtBreakdown.dueToday,
  });
  const clientDetailHref = `/clients/${clientId}${buildQueryString({
    lenderId,
    date,
  })}`;
  let backHref = `/portfolio${backQueryString}`;
  let backLabel = "Volver a cartera";

  if (origin === "reports") {
    backHref = `/reports${reportsBackQueryString}`;
    backLabel = "Volver a reportes";
  } else if (origin === "dashboard") {
    backHref = `/${backQueryString}`;
    backLabel = "Volver al inicio";
  } else if (origin === "client-detail") {
    backHref = clientDetailHref;
    backLabel = "Volver al cliente";
  } else if (origin === "dashboard-payment" || origin === "global-payment") {
    backHref = `/payments/new${paymentQueryString}`;
    backLabel = "Volver al cobro";
  }

  const currentInterestLabel =
    loan.type === "MONTHLY_INTEREST" ? "Interes vigente" : "Interes pendiente";
  const balanceLabel =
    loan.type === "MONTHLY_INTEREST"
      ? "Capital pendiente"
      : "Saldo pendiente del plan";

  return (
    <main className="page-shell page-shell-deep">
      <ContextHeader
        backHref={backHref}
        backLabel={backLabel}
        title="Prestamo"
        subtitle={`${formatLoanType(loan.type)} | ${loan.id.slice(0, 8)}`}
        secondaryHref={origin === "client-detail" ? undefined : clientDetailHref}
        secondaryLabel={origin === "client-detail" ? undefined : "Cliente"}
      />

      <LoanDetailHero
        clientFullName={loan.client.fullName}
        clientDocumentNumber={loan.client.documentNumber}
        loanTypeLabel={formatLoanType(loan.type)}
        lenderName={loan.lender.name}
        loanStatusLabel={formatLoanStatus(loan.status)}
        startDateLabel={formatLongDate(loan.startDate)}
        paymentFrequencyLabel={formatPaymentFrequency(loan.paymentFrequency)}
        principalAmountLabel={formatCurrency(loan.principalAmount)}
        expectedEndDateLabel={
          loan.expectedEndDate ? formatDateShort(loan.expectedEndDate) : "Sin fecha fija"
        }
        dateLabel={formatLongDate(date)}
        loanIdShort={loan.id.slice(0, 8)}
        installmentAmountLabel={
          loan.type === "FIXED_INSTALLMENTS"
            ? formatCurrency(loan.installmentAmount ?? 0)
            : null
        }
        totalInstallments={
          loan.type === "FIXED_INSTALLMENTS" ? loan.totalInstallments ?? 0 : null
        }
        monthlyInterestRateLabel={
          loan.type === "MONTHLY_INTEREST"
            ? formatPercentage(loan.monthlyInterestRate)
            : null
        }
        earlySettlementModeLabel={
          loan.type === "MONTHLY_INTEREST"
            ? formatSettlementMode(loan.earlySettlementInterestMode ?? "FULL_MONTH")
            : null
        }
      />

      <section className={`panel ${styles.summarySection}`}>
        <div
          className={`w-fit rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${getOperationalTone(
            {
              status: loan.status,
              overdue: debtBreakdown.overdue,
              dueToday: debtBreakdown.dueToday,
            },
          )}`}
        >
          {operationalLabel}
        </div>

        <div className={styles.summaryCard}>
          <p className={styles.summaryLabel}>Total cobrable hoy</p>
          <p className={styles.summaryValue}>
            {formatCurrency(debtBreakdown.totalCollectibleToday)}
          </p>
          <div className={styles.summaryMeta}>
            <span>
              {balanceLabel}: {formatCurrency(debtBreakdown.outstandingBalance)}
            </span>
            {debtBreakdown.overdue ? (
              <span>
                {debtBreakdown.daysLate} dia(s) de atraso | desde{" "}
                {debtBreakdown.oldestDueDate
                  ? formatDateShort(debtBreakdown.oldestDueDate)
                  : "-"}
              </span>
            ) : debtBreakdown.dueToday ? (
              <span>Vence en la fecha de corte actual.</span>
            ) : null}
          </div>
        </div>

        <form className={styles.controlBar}>
          <input type="hidden" name="lenderId" value={lenderId ?? ""} />
          {origin ? <input type="hidden" name="origin" value={origin} /> : null}
          {from ? <input type="hidden" name="from" value={from} /> : null}
          {to ? <input type="hidden" name="to" value={to} /> : null}
          <label className={styles.controlField}>
            <span className={styles.controlLabel}>Cambiar fecha</span>
            <input
              className={styles.controlInput}
              type="date"
              name="date"
              defaultValue={date}
              max={today}
            />
          </label>
          <button className={styles.controlButton} type="submit">
            Actualizar
          </button>
        </form>
      </section>

      <section className={`panel ${styles.sectionBlock}`}>
        <div className={styles.sectionHeading}>
          <p className="eyebrow">Desglose</p>
          <h2 className="section-title">Situacion financiera</h2>
        </div>

        <div className={styles.metricsPanel}>
          <DetailMetricCard
            label="Mora pendiente"
            value={formatCurrency(debtBreakdown.penalty.pending)}
            meta={`${debtBreakdown.penalty.pendingCount} registro(s)`}
            tone={debtBreakdown.penalty.pending > 0 ? "danger" : "neutral"}
          />
          <DetailMetricCard
            label="Interes vencido"
            value={formatCurrency(debtBreakdown.interest.overduePending)}
            meta={formatCurrency(debtBreakdown.overdueAmount)}
            tone={debtBreakdown.interest.overduePending > 0 ? "warning" : "neutral"}
          />
          <DetailMetricCard
            label={currentInterestLabel}
            value={formatCurrency(
              debtBreakdown.interest.currentPeriod?.interestPending ??
                debtBreakdown.interest.dueTodayPending,
            )}
            meta={
              debtBreakdown.interest.currentPeriod
                ? `${formatDateShort(
                    debtBreakdown.interest.currentPeriod.periodStartDate,
                  )} - ${formatDateShort(
                    debtBreakdown.interest.currentPeriod.periodEndDate,
                  )}`
                : "Sin periodo activo visible"
            }
            tone="brand"
          />
          <DetailMetricCard
            label={balanceLabel}
            value={formatCurrency(
              loan.type === "MONTHLY_INTEREST"
                ? debtBreakdown.loan.currentPrincipal
                : debtBreakdown.outstandingBalance,
            )}
          />
          <DetailMetricCard
            label="Monto del dia"
            value={formatCurrency(debtBreakdown.dueTodayAmount)}
            meta={debtBreakdown.dueToday ? "Exigible hoy" : "Sin vencimiento hoy"}
          />
          <DetailMetricCard
            label="Vencido"
            value={formatCurrency(debtBreakdown.overdueAmount)}
            meta={
              debtBreakdown.overdue
                ? `${debtBreakdown.daysLate} dia(s) de atraso`
                : "Sin atraso"
            }
            tone={debtBreakdown.overdue ? "danger" : "neutral"}
          />
        </div>
      </section>

      {loan.status === "ACTIVE" ? (
        <section className={`panel ${styles.sectionBlock}`} id="payoff">
          <div className={styles.sectionHeading}>
            <p className="eyebrow">Liquidacion</p>
            <h2 className="section-title">Monto para saldar</h2>
          </div>

          <div className={styles.payoffPanel}>
            <LoanActionCard
              title="Liquidacion segun modo actual"
              amount={formatCurrency(payoffFullMonth.totalPayoff)}
              description={
                loan.type === "MONTHLY_INTEREST"
                  ? `Incluye interes del periodo actual en modo ${formatSettlementMode(
                      payoffFullMonth.modeUsed ?? "FULL_MONTH",
                    ).toLowerCase()}.`
                  : "Incluye el saldo pendiente del plan y la mora existente."
              }
              href={`/payments/new${buildQueryString({
                lenderId,
                date,
                loanId: id,
                clientId,
                origin,
                from,
                to,
              })}`}
              ctaLabel="Usar en pago"
              tone="warning"
            />

            {payoffProrated ? (
              <LoanActionCard
                title="Liquidacion prorrateada por dias"
                amount={formatCurrency(payoffProrated.totalPayoff)}
                description={`Interes actual considerado: ${formatCurrency(
                  payoffProrated.currentPeriodInterestForPayoff ?? 0,
                )}${
                  payoffProrated.interestDaysCharged !== null &&
                  payoffProrated.interestDaysCharged !== undefined
                    ? ` | ${payoffProrated.interestDaysCharged} dia(s)`
                    : ""
                }.`}
                href={`/payments/new${buildQueryString({
                  lenderId,
                  date,
                  loanId: id,
                  mode: "PRORATED_BY_DAYS",
                  clientId,
                  origin,
                  from,
                  to,
                })}`}
                ctaLabel="Usar modo prorrateado"
                tone="brand"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {loan.type === "FIXED_INSTALLMENTS" ? (
        <section className="panel gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Cuotas</p>
              <h2 className="section-title">Calendario del prestamo</h2>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {loan.installments.length} cuota(s)
            </p>
          </div>

          {loan.installments.length > 0 ? (
            <>
              <div className={styles.metricsPanelThree}>
                <DetailMetricCard
                  label="Pagadas"
                  value={String(
                    loan.installments.filter(
                      (installment) => installment.status === "PAID",
                    ).length,
                  )}
                  meta={formatInstallmentStatus("PAID")}
                  tone="neutral"
                />
                <DetailMetricCard
                  label="Pendientes"
                  value={String(
                    loan.installments.filter(
                      (installment) => installment.status === "PENDING",
                    ).length,
                  )}
                  meta={formatInstallmentStatus("PENDING")}
                  tone="warning"
                />
                <DetailMetricCard
                  label="Atrasadas"
                  value={String(
                    loan.installments.filter(
                      (installment) => installment.status === "LATE",
                    ).length,
                  )}
                  meta={formatInstallmentStatus("LATE")}
                  tone="danger"
                />
              </div>

              <div className="space-y-3">
                {loan.installments.map((installment) => (
                  <InstallmentItem
                    key={installment.id}
                    installment={installment}
                    asOfDate={date}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="empty-panel">
              Este prestamo todavia no tiene cuotas registradas.
            </div>
          )}
        </section>
      ) : null}

      <section className={`panel ${styles.sectionBlock}`}>
        <div className={styles.sectionHeading}>
          <p className="eyebrow">Resumen operativo</p>
          <h2 className="section-title">Contexto del prestamo</h2>
        </div>

        <div className={styles.metricsPanel}>
          <DetailMetricCard
            label="Pagos registrados"
            value={String(summary.payments.count)}
            meta={formatCurrency(summary.payments.totalAmount)}
          />
          <DetailMetricCard
            label="Interes generado"
            value={formatCurrency(summary.interest.totalGenerated)}
            meta={formatCurrency(summary.interest.totalPaid)}
          />
          <DetailMetricCard
            label="Mora pendiente"
            value={formatCurrency(summary.penalty.totalPending)}
            meta={formatCurrency(summary.penalty.totalCharged)}
            tone={summary.penalty.totalPending > 0 ? "danger" : "neutral"}
          />
          <DetailMetricCard
            label="Ganancia neta"
            value={formatCurrency(summary.profit.netProfit)}
            meta={formatCurrency(summary.capital.totalPaid)}
            tone="brand"
          />
        </div>
      </section>

      <section className="panel gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Actividad</p>
            <h2 className="section-title">Pagos recientes</h2>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {loan.payments.length} registro(s)
          </p>
        </div>

        {loan.payments.length > 0 ? (
          <div className="space-y-3">
            {loan.payments.slice(0, 4).map((payment) => (
              <RecentPaymentItem key={payment.id} payment={payment} />
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            Este prestamo todavia no tiene pagos registrados.
          </div>
        )}
      </section>

      {loan.status !== "ACTIVE" ? (
        <section className="panel gap-4">
          <div>
            <p className="eyebrow">Operacion bloqueada</p>
            <h2 className="section-title">Prestamo cerrado</h2>
          </div>
          <div className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--muted)]">
            Este prestamo ya no esta activo. La interfaz bloquea nuevas acciones
            de pago o liquidacion.
          </div>
        </section>
      ) : (
        <ScrollAwareActionBar>
          <div className="deep-action-bar-inner">
            <Link
              className="deep-action-button"
              href={`/payments/new${paymentQueryString}`}
            >
              <span className="deep-action-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M4 7.5h16v9H4z" />
                  <path d="M8 12h8" />
                  <path d="M7 10h.01M17 14h.01" />
                </svg>
              </span>
              <span className="deep-action-button-label">Registrar pago</span>
            </Link>
            <a
              className="deep-action-button deep-action-button-primary"
              href="#payoff"
            >
              <span className="deep-action-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M7 3.5h7l4 4V20.5H7z" />
                  <path d="M14 3.5v4h4" />
                  <path d="M10 12h5M10 15h5M10 18h3" />
                </svg>
              </span>
              <span className="deep-action-button-label">Ver liquidacion</span>
            </a>
          </div>
        </ScrollAwareActionBar>
      )}
    </main>
  );
}





