"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { LoanDetailPageData } from "@/features/loan-detail/types";
import { createPayment, simulatePayment } from "@/features/payments/lib/api";
import {
  CreatedPaymentResponse,
  PaymentOperationType,
  PaymentSimulationResponse,
} from "@/features/payments/types";
import {
  formatCurrency,
  formatDateShort,
  formatLoanType,
  formatSettlementMode,
} from "@/shared/lib/format";
import { ContextHeader } from "@/shared/components/context-header";
import styles from "./payment-form-shell.module.css";

type PaymentFormShellProps = {
  loanData: LoanDetailPageData;
  initialDate: string;
  backHref: string;
  loanDetailHref: string;
  selectionHref?: string;
  dashboardHref: string;
  initialMode?: "FULL_MONTH" | "PRORATED_BY_DAYS";
};

type SimulationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: PaymentSimulationResponse };

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatMoneyInput(value: string) {
  if (!value) {
    return "";
  }

  return formatCurrency(Number(value));
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function preventImplicitSubmit(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter") {
    return;
  }

  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }

  const tagName = target.tagName;
  if (tagName === "INPUT" || tagName === "SELECT") {
    event.preventDefault();
  }
}

export function PaymentFormShell({
  loanData,
  initialDate,
  backHref,
  loanDetailHref,
  selectionHref,
  dashboardHref,
  initialMode,
}: PaymentFormShellProps) {
  const router = useRouter();
  const [paymentDate, setPaymentDate] = useState(initialDate);
  const [amount, setAmount] = useState("");
  const [operationType, setOperationType] =
    useState<PaymentOperationType>("REGULAR_PAYMENT");
  const [settlementMode, setSettlementMode] = useState<
    "FULL_MONTH" | "PRORATED_BY_DAYS"
  >(
    initialMode ??
      (loanData.loan.earlySettlementInterestMode === "PRORATED_BY_DAYS"
        ? "PRORATED_BY_DAYS"
        : "FULL_MONTH"),
  );
  const [simulation, setSimulation] = useState<SimulationState>({
    status: "idle",
  });
  const [submitState, setSubmitState] = useState<
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "error"; message: string }
    | { status: "success"; data: CreatedPaymentResponse }
  >({ status: "idle" });
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const submitLockRef = useRef(false);

  const numericAmount = useMemo(() => Number(amount), [amount]);
  const maxPaymentDate = useMemo(() => toDateInputValue(new Date()), []);
  const canUseEarlySettlement = loanData.loan.type === "MONTHLY_INTEREST";
  const isEarlySettlement = operationType === "EARLY_SETTLEMENT";
  const summary = loanData.debtBreakdown;
  const isLoanActive = loanData.loan.status === "ACTIVE";
  const defaultSettlementMode =
    initialMode ??
    (loanData.loan.earlySettlementInterestMode === "PRORATED_BY_DAYS"
      ? "PRORATED_BY_DAYS"
      : "FULL_MONTH");
  const hasUnsavedChanges =
    paymentDate !== initialDate ||
    amount.trim().length > 0 ||
    operationType !== "REGULAR_PAYMENT" ||
    settlementMode !== defaultSettlementMode;

  useEffect(() => {
    if (!isCancelDialogOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCancelDialogOpen]);

  useEffect(() => {
    if (!isLoanActive) {
      setSimulation({ status: "idle" });
      return;
    }

    if (!paymentDate || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSimulation({ status: "idle" });
      return;
    }

    let cancelled = false;
    setSimulation({ status: "loading" });

    const timeoutId = window.setTimeout(async () => {
      const result = await simulatePayment({
        loanId: loanData.loan.id,
        amount: numericAmount,
        paymentDate,
        operationType,
        mode: isEarlySettlement ? settlementMode : undefined,
      });

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setSimulation({ status: "error", message: result.error });
        return;
      }

      setSimulation({ status: "success", data: result.data });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    paymentDate,
    numericAmount,
    operationType,
    settlementMode,
    isEarlySettlement,
    isLoanActive,
    loanData.loan.id,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitLockRef.current) {
      return;
    }

    if (!isLoanActive) {
      setSubmitState({
        status: "error",
        message: "Este prestamo ya no esta activo y no admite nuevos pagos.",
      });
      return;
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setSubmitState({
        status: "error",
        message: "Ingresa un monto valido para registrar el pago.",
      });
      return;
    }

    if (simulation.status !== "success") {
      setSubmitState({
        status: "error",
        message: "Espera la simulacion antes de confirmar el pago.",
      });
      return;
    }

    if (isEarlySettlement && !simulation.data.isAmountSufficient) {
      setSubmitState({
        status: "error",
        message:
          "La liquidacion anticipada requiere un monto suficiente para cerrar el prestamo.",
      });
      return;
    }

    submitLockRef.current = true;
    setSubmitState({ status: "submitting" });

    const result = await createPayment({
      loanId: loanData.loan.id,
      clientId: loanData.loan.clientId,
      totalAmount: numericAmount,
      paymentDate,
      isEarlySettlement,
      earlySettlementInterestModeOverride: isEarlySettlement
        ? settlementMode
        : undefined,
    });

    if (!result.ok) {
      setSubmitState({ status: "error", message: result.error });
      submitLockRef.current = false;
      return;
    }

    setSubmitState({ status: "success", data: result.data });
  }

  const isSubmitDisabled =
    !isLoanActive ||
    submitState.status === "submitting" ||
    submitState.status === "success" ||
    simulation.status !== "success" ||
    (isEarlySettlement &&
      simulation.status === "success" &&
      !simulation.data.isAmountSufficient);

  function handleCancelIntent() {
    if (submitState.status === "submitting") {
      return;
    }

    if (!hasUnsavedChanges) {
      router.push(backHref);
      return;
    }

    setIsCancelDialogOpen(true);
  }

  function handleConfirmCancel() {
    setIsCancelDialogOpen(false);
    router.push(backHref);
  }

  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <ContextHeader
        backHref={backHref}
        backLabel="Cancelar"
        backIcon="close"
        backOnClick={handleCancelIntent}
        title="Registrar pago"
        subtitle={`${formatLoanType(loanData.loan.type)} | ${loanData.loan.id.slice(0, 8)}`}
        secondaryHref={loanDetailHref}
        secondaryLabel="Prestamo"
      />

      <section className={`panel ${styles.summarySection}`}>
        <div className={styles.summaryCopy}>
          <p className="eyebrow">Registrar pago</p>
          <h1 className={styles.summaryTitle}>{loanData.loan.client.fullName}</h1>
          <p className={styles.summarySubtitle}>
            {formatLoanType(loanData.loan.type)} | Total cobrable hoy{" "}
            {formatCurrency(summary.totalCollectibleToday)}
          </p>
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCell}>
            <p className={styles.summaryLabel}>Total cobrable hoy</p>
            <p className={styles.summaryValue}>
              {formatCurrency(summary.totalCollectibleToday)}
            </p>
          </div>
          <div className={styles.summaryCell}>
            <p className={styles.summaryLabel}>Saldo pendiente</p>
            <p className={styles.summaryValue}>
              {formatCurrency(summary.outstandingBalance)}
            </p>
          </div>
        </div>

        {summary.overdue ? (
          <div className={styles.overdueNotice}>
            Mora pendiente: {formatCurrency(summary.penalty.pending)} | {summary.daysLate} dia(s) de atraso
          </div>
        ) : null}
      </section>

      {!isLoanActive ? (
        <section className="panel gap-4">
          <div>
            <p className="eyebrow">Operacion bloqueada</p>
            <h2 className="section-title">Prestamo cerrado</h2>
          </div>
          <div className={styles.blockedNotice}>
            Este prestamo ya no esta activo. La interfaz bloquea por completo
            nuevas acciones de pago o liquidacion.
          </div>
        </section>
      ) : (
        <>
          <section className={`panel ${styles.formSection}`}>
            <div>
              <p className="eyebrow">Formulario</p>
              <h2 className="section-title">Datos del pago</h2>
            </div>

            <form
              className={styles.formContent}
              onSubmit={handleSubmit}
              onKeyDown={preventImplicitSubmit}
            >
              <div className={styles.fieldGrid}>
                <label className="surface-field">
                  <span className="surface-label">Fecha del pago</span>
                  <input
                    className="surface-input"
                    type="date"
                    value={paymentDate}
                    max={maxPaymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                  />
                </label>

                <label className="surface-field">
                  <span className="surface-label">Monto recibido</span>
                  <input
                    className={`surface-input ${styles.amountInput}`}
                    type="text"
                    inputMode="numeric"
                    placeholder="$ 0"
                    value={formatMoneyInput(amount)}
                    onChange={(event) =>
                      setAmount(sanitizeIntegerInput(event.target.value))
                    }
                    autoComplete="off"
                  />
                </label>
              </div>

              <div className={styles.optionBlock}>
                <p className="surface-label">Tipo de operacion</p>
                <div className={styles.chipsRow}>
                  <button
                    className={`filter-chip ${
                      operationType === "REGULAR_PAYMENT"
                        ? "filter-chip-active"
                        : ""
                    }`}
                    type="button"
                    onClick={() => setOperationType("REGULAR_PAYMENT")}
                  >
                    Pago normal
                  </button>

                  {canUseEarlySettlement ? (
                    <button
                      className={`filter-chip ${
                        operationType === "EARLY_SETTLEMENT"
                          ? "filter-chip-active"
                          : ""
                      }`}
                      type="button"
                      onClick={() => setOperationType("EARLY_SETTLEMENT")}
                    >
                      Liquidacion anticipada
                    </button>
                  ) : null}
                </div>

                {!canUseEarlySettlement ? (
                  <p className={styles.helperCopy}>
                    Este tipo de prestamo solo permite pago normal en esta etapa.
                  </p>
                ) : null}
              </div>

              {isEarlySettlement && canUseEarlySettlement ? (
                <div className={styles.modePanel}>
                  <p className="surface-label">Modo de liquidacion</p>
                  <div className={styles.chipsRow}>
                    <button
                      className={`filter-chip ${
                        settlementMode === "FULL_MONTH"
                          ? "filter-chip-active"
                          : ""
                      }`}
                      type="button"
                      onClick={() => setSettlementMode("FULL_MONTH")}
                    >
                      Mes completo
                    </button>
                    <button
                      className={`filter-chip ${
                        settlementMode === "PRORATED_BY_DAYS"
                          ? "filter-chip-active"
                          : ""
                      }`}
                      type="button"
                      onClick={() => setSettlementMode("PRORATED_BY_DAYS")}
                    >
                      Prorrateado por dias
                    </button>
                  </div>
                  <p className={styles.helperCopy}>
                    El backend definira el interes cobrable del periodo actual
                    segun el modo elegido.
                  </p>
                </div>
              ) : null}

              <section className={styles.simulationPanel}>
                <div>
                  <p className="eyebrow">Simulacion</p>
                  <h3 className="section-title">Distribucion estimada</h3>
                </div>

                {simulation.status === "idle" ? (
                  <div className={styles.simulationState}>
                    Ingresa monto y fecha para ver como se aplicaria el pago.
                  </div>
                ) : null}

                {simulation.status === "loading" ? (
                  <div className={styles.simulationLoading}>
                    <div className={styles.skeleton} />
                    <div className={styles.skeleton} />
                  </div>
                ) : null}

                {simulation.status === "error" ? (
                  <div className={styles.errorMessage}>{simulation.message}</div>
                ) : null}

                {simulation.status === "success" ? (
                  <div className="space-y-4">
                    <div className={styles.metricGrid}>
                      <div className={styles.metricCell}>
                        <p className={styles.metricLabel}>A mora</p>
                        <p className={styles.metricValue}>
                          {formatCurrency(
                            simulation.data.distribution.appliedToPenalty,
                          )}
                        </p>
                      </div>
                      <div className={styles.metricCell}>
                        <p className={styles.metricLabel}>A interes</p>
                        <p className={styles.metricValue}>
                          {formatCurrency(
                            simulation.data.distribution.appliedToInterest,
                          )}
                        </p>
                      </div>
                      <div className={styles.metricCell}>
                        <p className={styles.metricLabel}>A capital</p>
                        <p className={styles.metricValue}>
                          {formatCurrency(
                            simulation.data.distribution.appliedToPrincipal,
                          )}
                        </p>
                      </div>
                      <div className={styles.metricCell}>
                        <p className={styles.metricLabel}>Sobrante</p>
                        <p className={styles.metricValue}>
                          {formatCurrency(simulation.data.distribution.remaining)}
                        </p>
                      </div>
                    </div>

                    {simulation.data.operationType === "EARLY_SETTLEMENT" &&
                    simulation.data.payoff ? (
                      <div className={styles.payoffNotice}>
                        <p className={styles.payoffTitle}>
                          Total para saldar:{" "}
                          {formatCurrency(simulation.data.payoff.totalPayoff)}
                        </p>
                        <p className={styles.payoffMeta}>
                          Modo usado:{" "}
                          {formatSettlementMode(
                            simulation.data.modeUsed ?? "FULL_MONTH",
                          )}
                          {simulation.data.interestDaysCharged !== null
                            ? ` | ${simulation.data.interestDaysCharged} dia(s)`
                            : ""}
                        </p>
                        {!simulation.data.isAmountSufficient ? (
                          <p className={styles.payoffWarning}>
                            El monto actual no alcanza para cerrar el prestamo.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {submitState.status === "error" ? (
                <div className={styles.errorMessage}>{submitState.message}</div>
              ) : null}

              <div className={styles.actionRow}>
                <button
                  className={styles.actionButtonSecondary}
                  type="button"
                  onClick={handleCancelIntent}
                  disabled={submitState.status === "submitting"}
                >
                  Cancelar
                </button>
                <button
                  className={styles.actionButtonPrimary}
                  type="submit"
                  disabled={isSubmitDisabled}
                >
                  {submitState.status === "submitting"
                    ? "Guardando..."
                    : submitState.status === "success"
                      ? "Pago registrado"
                      : "Confirmar pago"}
                </button>
              </div>
            </form>
          </section>

          {submitState.status === "success" ? (
            <section className={`panel ${styles.resultSection}`}>
              <div>
                <p className="eyebrow">Resultado</p>
                <h2 className="section-title">Pago registrado</h2>
              </div>

              <div className={styles.resultNotice}>
                <p className={styles.resultNoticeText}>
                  Pago de {formatCurrency(submitState.data.payment.totalAmount)} aplicado el {formatDateShort(submitState.data.payment.paymentDate)}.
                </p>
              </div>

              <div className={styles.resultGrid}>
                <div className={styles.metricCell}>
                  <p className={styles.metricLabel}>Mora</p>
                  <p className={styles.metricValue}>
                    {formatCurrency(
                      submitState.data.distribution.appliedToPenalty,
                    )}
                  </p>
                </div>
                <div className={styles.metricCell}>
                  <p className={styles.metricLabel}>Interes</p>
                  <p className={styles.metricValue}>
                    {formatCurrency(
                      submitState.data.distribution.appliedToInterest,
                    )}
                  </p>
                </div>
                <div className={styles.metricCell}>
                  <p className={styles.metricLabel}>Capital</p>
                  <p className={styles.metricValue}>
                    {formatCurrency(
                      submitState.data.distribution.appliedToPrincipal,
                    )}
                  </p>
                </div>
              </div>

              <div className={styles.resultActions}>
                <Link className={styles.linkButtonSecondary} href={loanDetailHref}>
                  Volver al prestamo
                </Link>
                {selectionHref ? (
                  <Link className={styles.linkButton} href={selectionHref}>
                    Registrar otro pago
                  </Link>
                ) : (
                  <Link className={styles.linkButton} href={dashboardHref}>
                    Volver al inicio
                  </Link>
                )}
              </div>
            </section>
          ) : null}
        </>
      )}

      {isCancelDialogOpen ? (
        <div
          className="confirm-modal-overlay"
          role="presentation"
          onClick={() => setIsCancelDialogOpen(false)}
        >
          <div
            className="confirm-modal-card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-payment-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal-icon-wrap" aria-hidden="true">
              <svg
                className="confirm-modal-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
              >
                <path d="M12 8v5" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>

            <div className="confirm-modal-copy">
              <h2 className="confirm-modal-title" id="cancel-payment-title">
                Quieres cancelar el pago?
              </h2>
              <p className="confirm-modal-subtitle">
                Se perderan los datos que ya ingresaste en este formulario.
              </p>
            </div>

            <div className="confirm-modal-actions">
              <button
                className="confirm-modal-button confirm-modal-button-primary"
                type="button"
                onClick={handleConfirmCancel}
              >
                Si, cancelar
              </button>
              <button
                className="confirm-modal-button"
                type="button"
                onClick={() => setIsCancelDialogOpen(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
