"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createLoan, getActiveClients } from "@/features/loans/lib/api";
import { ActiveClientOption, CreateLoanResponse } from "@/features/loans/types";
import { ContextHeader } from "@/shared/components/context-header";
import {
  formatCurrency,
  formatLoanType,
  formatPaymentFrequency,
  formatSettlementMode,
} from "@/shared/lib/format";
import styles from "./create-loan-form-shell.module.css";

const ClientPickerDialog = dynamic(
  () => import("./client-picker-dialog").then((mod) => mod.ClientPickerDialog),
  { ssr: false },
);

type CreateLoanFormShellProps = {
  initialDate: string;
  dashboardHref: string;
};

const fixedFrequencyOptions = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
] as const;
const MAX_MONTHLY_INTEREST_PERCENT = 100;

function sanitizeIntegerInput(value: string) {
  return value.replace(/[^\d]/g, "");
}

function sanitizeDecimalInput(value: string) {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = normalized.split(".");

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join("")}`;
}

function sanitizePercentageInput(value: string) {
  const normalized = sanitizeDecimalInput(value);

  if (!normalized) {
    return "";
  }

  const numericValue = Number(normalized);
  if (!Number.isFinite(numericValue)) {
    return normalized;
  }

  if (numericValue > MAX_MONTHLY_INTEREST_PERCENT) {
    return String(MAX_MONTHLY_INTEREST_PERCENT);
  }

  return normalized;
}

function formatMoneyInput(value: string) {
  if (!value) {
    return "";
  }

  return formatCurrency(Number(value));
}

function formatPercentInput(value: string) {
  if (!value) {
    return "";
  }

  const normalized = sanitizeDecimalInput(value);
  return normalized;
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function CreateLoanFormShell({
  initialDate,
  dashboardHref,
}: CreateLoanFormShellProps) {
  const maxStartDate = useMemo(() => toDateInputValue(new Date()), []);
  const [loanType, setLoanType] = useState<"FIXED_INSTALLMENTS" | "MONTHLY_INTEREST">(
    "FIXED_INSTALLMENTS",
  );
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [principalAmount, setPrincipalAmount] = useState("");
  const [monthlyInterestRate, setMonthlyInterestRate] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [paymentFrequency, setPaymentFrequency] = useState<(typeof fixedFrequencyOptions)[number]>("WEEKLY");
  const [earlySettlementInterestMode, setEarlySettlementInterestMode] = useState<
    "FULL_MONTH" | "PRORATED_BY_DAYS"
  >("FULL_MONTH");
  const [startDate, setStartDate] = useState(initialDate);
  const [showAdvancedMonthlyOptions, setShowAdvancedMonthlyOptions] = useState(false);
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [submitState, setSubmitState] = useState<
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "error"; message: string }
    | { status: "success"; data: CreateLoanResponse }
  >({ status: "idle" });
  const [clientsState, setClientsState] = useState<
    | { status: "idle"; data: ActiveClientOption[] }
    | { status: "loading"; data: ActiveClientOption[] }
    | { status: "ready"; data: ActiveClientOption[] }
    | { status: "error"; data: ActiveClientOption[]; message: string }
  >({ status: "idle", data: [] });
  const submitLockRef = useRef(false);

  const availableClients = clientsState.data;
  const selectedClient = useMemo(
    () => availableClients.find((client) => client.id === clientId) ?? null,
    [availableClients, clientId],
  );
  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();

    if (!query) {
      return availableClients;
    }

    return availableClients.filter((client) => {
      return (
        client.fullName.toLowerCase().includes(query) ||
        client.documentNumber.toLowerCase().includes(query) ||
        (client.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [availableClients, clientSearch]);

  const previewTypeLabel = formatLoanType(loanType);
  const previewPrincipal = Number(principalAmount || 0);
  const previewInstallment = Number(installmentAmount || 0);
  const previewMonthlyInterestPercent = Number(monthlyInterestRate || 0);
  const isSubmitDisabled =
    submitState.status === "submitting" ||
    submitState.status === "success" ||
    !clientId;

  useEffect(() => {
    if (!isClientPickerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isClientPickerOpen]);
  async function loadClients(force = false) {
    if (!force && (clientsState.status === "loading" || clientsState.status === "ready")) {
      return;
    }

    setClientsState((current) => ({ status: "loading", data: current.data }));
    const result = await getActiveClients();

    if (!result.ok) {
      setClientsState({
        status: "error",
        data: [],
        message: result.error,
      });
      return;
    }

    setClientsState({ status: "ready", data: result.data });
  }

  async function handleOpenClientPicker() {
    setIsClientPickerOpen(true);
    await loadClients();
  }

  useEffect(() => {
    if (!isClientPickerOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsClientPickerOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape as unknown as EventListener);
    return () => {
      window.removeEventListener(
        "keydown",
        handleEscape as unknown as EventListener,
      );
    };
  }, [isClientPickerOpen]);


  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitLockRef.current) {
      return;
    }

    if (!clientId) {
      setSubmitState({
        status: "error",
        message: "Selecciona un cliente para abrir el prestamo.",
      });
      return;
    }

    if (!Number.isFinite(previewPrincipal) || previewPrincipal <= 0) {
      setSubmitState({
        status: "error",
        message: "Ingresa un monto de capital valido.",
      });
      return;
    }

    if (loanType === "FIXED_INSTALLMENTS") {
      const installments = Number(totalInstallments);

      if (!Number.isFinite(previewInstallment) || previewInstallment <= 0) {
        setSubmitState({
          status: "error",
          message: "Ingresa un valor de cuota valido.",
        });
        return;
      }

      if (!Number.isFinite(installments) || installments < 1) {
        setSubmitState({
          status: "error",
          message: "Ingresa un numero valido de cuotas.",
        });
        return;
      }
    } else {
      const ratePercent = Number(monthlyInterestRate);

      if (!Number.isFinite(ratePercent) || ratePercent <= 0) {
        setSubmitState({
          status: "error",
          message: "Ingresa una tasa mensual mayor que 0.",
        });
        return;
      }

      if (ratePercent > MAX_MONTHLY_INTEREST_PERCENT) {
        setSubmitState({
          status: "error",
          message: "La tasa mensual debe estar entre 0 y 100%.",
        });
        return;
      }
    }

    submitLockRef.current = true;
    setSubmitState({ status: "submitting" });

    const result = await createLoan({
      clientId,
      type: loanType,
      principalAmount: previewPrincipal,
      monthlyInterestRate:
        loanType === "MONTHLY_INTEREST"
          ? Number((previewMonthlyInterestPercent / 100).toFixed(6))
          : undefined,
      installmentAmount:
        loanType === "FIXED_INSTALLMENTS" ? previewInstallment : undefined,
      totalInstallments:
        loanType === "FIXED_INSTALLMENTS" ? Number(totalInstallments) : undefined,
      paymentFrequency:
        loanType === "MONTHLY_INTEREST" ? "MONTHLY" : paymentFrequency,
      earlySettlementInterestMode:
        loanType === "MONTHLY_INTEREST"
          ? earlySettlementInterestMode
          : undefined,
      startDate,
      expectedEndDate: expectedEndDate || undefined,
    });

    if (!result.ok) {
      setSubmitState({ status: "error", message: result.error });
      submitLockRef.current = false;
      return;
    }

    setSubmitState({ status: "success", data: result.data });
  }

  function handleClientSelect(client: ActiveClientOption) {
    setClientId(client.id);
    setClientSearch("");
    setIsClientPickerOpen(false);
  }

  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <ContextHeader
        backHref={dashboardHref}
        backLabel="Volver al dashboard"
        title="Nuevo prestamo"
        subtitle="Alta operativa del credito"
      />

      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroCopy}>
          <p className="eyebrow">Nuevo prestamo</p>
          <h1 className={styles.heroTitle}>Abrir credito</h1>
          <p className={styles.heroSubtitle}>
            Crea el prestamo y deja el calculo financiero en manos del backend.
          </p>
        </div>

        <button
          className={styles.clientCardButton}
          type="button"
          onClick={handleOpenClientPicker}
        >
          <div className={styles.clientCardHeader}>
            <p className="eyebrow">Cliente</p>
            <span className={styles.clientCardChevron} aria-hidden="true">
              {">"}
            </span>
          </div>
          {selectedClient ? (
            <>
              <p className={styles.clientName}>{selectedClient.fullName}</p>
              <p className={styles.clientMeta}>C.C. {selectedClient.documentNumber}</p>
            </>
          ) : (
            <>
              <p className={styles.clientName}>Selecciona un cliente</p>
              <p className={styles.clientMeta}>
                Elige a quien se le abrira el prestamo.
              </p>
            </>
          )}
        </button>
      </section>

      <section className={`panel ${styles.formSection}`}>
        <div>
          <p className="eyebrow">Formulario</p>
          <h2 className="section-title">Datos base</h2>
        </div>
          <form
            className={styles.formContent}
            onSubmit={handleSubmit}
            onKeyDown={preventImplicitSubmit}
          >
            <div className={styles.optionBlock}>
              <p className="surface-label">Tipo de prestamo</p>
              <div className={styles.chipsRow}>
                <button
                  className={`filter-chip ${
                    loanType === "FIXED_INSTALLMENTS" ? "filter-chip-active" : ""
                  }`}
                  type="button"
                  onClick={() => setLoanType("FIXED_INSTALLMENTS")}
                >
                  Cuotas fijas
                </button>
                <button
                  className={`filter-chip ${
                    loanType === "MONTHLY_INTEREST" ? "filter-chip-active" : ""
                  }`}
                  type="button"
                  onClick={() => setLoanType("MONTHLY_INTEREST")}
                >
                  Interes mensual
                </button>
              </div>
            </div>

            <div className={styles.fieldGrid}>
              <label className="surface-field">
                <span className="surface-label">Monto prestado</span>
                <input
                  className={`surface-input ${styles.amountInput}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="$ 0"
                  value={formatMoneyInput(principalAmount)}
                  onChange={(event) =>
                    setPrincipalAmount(sanitizeIntegerInput(event.target.value))
                  }
                  autoComplete="off"
                />
              </label>

              <div className={styles.twoColumnGrid}>
                <label className="surface-field">
                  <span className="surface-label">Fecha de inicio</span>
                  <input
                    className="surface-input"
                    type="date"
                    value={startDate}
                    max={maxStartDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>

                <label className="surface-field">
                  <span className="surface-label">Fecha esperada</span>
                  <input
                    className="surface-input"
                    type="date"
                    value={expectedEndDate}
                    onChange={(event) => setExpectedEndDate(event.target.value)}
                  />
                </label>
              </div>
            </div>

            {loanType === "FIXED_INSTALLMENTS" ? (
              <div className={styles.configPanel}>
                <div>
                  <p className="eyebrow">Configuracion</p>
                  <h3 className="section-title">Cuotas fijas</h3>
                </div>

                <div className={styles.twoColumnGrid}>
                  <label className="surface-field">
                    <span className="surface-label">Valor de cuota</span>
                    <input
                      className="surface-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="$ 0"
                      value={formatMoneyInput(installmentAmount)}
                      onChange={(event) =>
                        setInstallmentAmount(
                          sanitizeIntegerInput(event.target.value),
                        )
                      }
                      autoComplete="off"
                    />
                  </label>

                  <label className="surface-field">
                    <span className="surface-label">Numero de cuotas</span>
                    <input
                      className="surface-input"
                      type="text"
                      inputMode="numeric"
                      value={totalInstallments}
                      onChange={(event) =>
                        setTotalInstallments(
                          sanitizeIntegerInput(event.target.value),
                        )
                      }
                      autoComplete="off"
                    />
                  </label>
                </div>

                <div className={styles.optionBlock}>
                  <p className="surface-label">Frecuencia</p>
                  <div className={styles.chipsRow}>
                    {fixedFrequencyOptions.map((frequency) => (
                      <button
                        key={frequency}
                        className={`filter-chip ${
                          paymentFrequency === frequency ? "filter-chip-active" : ""
                        }`}
                        type="button"
                        onClick={() => setPaymentFrequency(frequency)}
                      >
                        {formatPaymentFrequency(frequency)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.configPanel}>
                <div>
                  <p className="eyebrow">Configuracion</p>
                  <h3 className="section-title">Interes mensual</h3>
                </div>

                <label className="surface-field">
                  <span className="surface-label">Tasa mensual</span>
                  <div className={styles.percentField}>
                    <input
                      className={`surface-input ${styles.percentInput}`}
                      type="text"
                      inputMode="decimal"
                      placeholder="15"
                      value={formatPercentInput(monthlyInterestRate)}
                      onChange={(event) =>
                        setMonthlyInterestRate(
                          sanitizePercentageInput(event.target.value),
                        )
                      }
                      autoComplete="off"
                      aria-describedby="monthly-interest-helper"
                    />
                    <span className={styles.percentSuffix} aria-hidden="true">
                      %
                    </span>
                  </div>
                </label>

                <button
                  className={styles.advancedToggle}
                  type="button"
                  onClick={() => setShowAdvancedMonthlyOptions((value) => !value)}
                  aria-expanded={showAdvancedMonthlyOptions}
                >
                  {showAdvancedMonthlyOptions
                    ? "Ocultar opciones avanzadas"
                    : "Opciones avanzadas"}
                </button>

                <p className={styles.helperCopy} id="monthly-interest-helper">
                  Escribe el porcentaje mensual completo. Ejemplo: 6 para 6%, 12.5 para
                  12.5%. Por defecto se aplica Mes completo.
                </p>

                {showAdvancedMonthlyOptions ? (
                  <div className={styles.optionBlock}>
                    <p className="surface-label">Liquidacion anticipada</p>
                    <div className={styles.chipsRow}>
                      <button
                        className={`filter-chip ${
                          earlySettlementInterestMode === "FULL_MONTH"
                            ? "filter-chip-active"
                            : ""
                        }`}
                        type="button"
                        onClick={() => setEarlySettlementInterestMode("FULL_MONTH")}
                      >
                        Mes completo
                      </button>
                      <button
                        className={`filter-chip ${
                          earlySettlementInterestMode === "PRORATED_BY_DAYS"
                            ? "filter-chip-active"
                            : ""
                        }`}
                        type="button"
                        onClick={() =>
                          setEarlySettlementInterestMode("PRORATED_BY_DAYS")
                        }
                      >
                        Prorrateado
                      </button>
                    </div>
                  </div>
                ) : null}

              </div>
            )}

            <section className={styles.summaryPanel}>
              <div>
                <p className="eyebrow">Resumen</p>
                <h3 className="section-title">Vista previa del prestamo</h3>
              </div>

              <div className={styles.summaryGrid}>
                <div className={styles.summaryCell}>
                  <p className={styles.summaryLabel}>Tipo</p>
                  <p className={styles.summaryValue}>{previewTypeLabel}</p>
                </div>
                <div className={styles.summaryCell}>
                  <p className={styles.summaryLabel}>Capital</p>
                  <p className={styles.summaryValue}>{formatCurrency(previewPrincipal)}</p>
                </div>
                {loanType === "FIXED_INSTALLMENTS" ? (
                  <>
                    <div className={styles.summaryCell}>
                      <p className={styles.summaryLabel}>Cuota</p>
                      <p className={styles.summaryValue}>
                        {formatCurrency(previewInstallment)}
                      </p>
                    </div>
                    <div className={styles.summaryCell}>
                      <p className={styles.summaryLabel}>Frecuencia</p>
                      <p className={styles.summaryValue}>
                        {formatPaymentFrequency(paymentFrequency)}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.summaryCell}>
                      <p className={styles.summaryLabel}>Tasa mensual</p>
                      <p className={styles.summaryValue}>
                        {monthlyInterestRate ? `${monthlyInterestRate}%` : "-"}
                      </p>
                    </div>
                    <div className={styles.summaryCell}>
                      <p className={styles.summaryLabel}>Liquidacion</p>
                      <p className={styles.summaryValue}>
                        {formatSettlementMode(earlySettlementInterestMode)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </section>

            {submitState.status === "error" ? (
              <div className={styles.errorMessage}>{submitState.message}</div>
            ) : null}

            <div className={styles.actionRow}>
              <Link className={styles.actionButtonSecondary} href={dashboardHref}>
                Cancelar
              </Link>
              <button
                className={styles.actionButtonPrimary}
                type="submit"
                disabled={isSubmitDisabled}
              >
                {submitState.status === "submitting"
                  ? "Creando..."
                  : submitState.status === "success"
                    ? "Prestamo creado"
                    : "Crear prestamo"}
              </button>
            </div>
          </form>
      </section>

      {submitState.status === "success" ? (
        <section className={`panel ${styles.resultSection}`}>
          <div>
            <p className="eyebrow">Resultado</p>
            <h2 className="section-title">Prestamo creado</h2>
          </div>

          <div className={styles.resultNotice}>
            <p className={styles.resultNoticeText}>
              Se abrio un prestamo de {formatCurrency(submitState.data.principalAmount)} para{" "}
              {submitState.data.client.fullName}.
            </p>
          </div>

          <div className={styles.resultGrid}>
            <div className={styles.summaryCell}>
              <p className={styles.summaryLabel}>Tipo</p>
              <p className={styles.summaryValue}>
                {formatLoanType(submitState.data.type)}
              </p>
            </div>
            <div className={styles.summaryCell}>
              <p className={styles.summaryLabel}>Estado</p>
              <p className={styles.summaryValue}>{submitState.data.status}</p>
            </div>
          </div>

          <Link
            className={styles.successLink}
            href={`/loans/${submitState.data.id}?date=${encodeURIComponent(startDate)}`}
          >
            Ir al prestamo
          </Link>
        </section>
      ) : null}

      <ClientPickerDialog
        isOpen={isClientPickerOpen}
        clientId={clientId}
        clientSearch={clientSearch}
        clientsState={clientsState}
        filteredClients={filteredClients}
        availableClientsCount={availableClients.length}
        onClose={() => setIsClientPickerOpen(false)}
        onRetry={() => loadClients(true)}
        onSearchChange={setClientSearch}
        onSelect={handleClientSelect}
      />
    </main>
  );
}





