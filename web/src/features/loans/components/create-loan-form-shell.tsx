"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createLoan } from "@/features/loans/lib/api";
import { ActiveClientOption, CreateLoanResponse } from "@/features/loans/types";
import { ContextHeader } from "@/shared/components/context-header";
import {
  formatCurrency,
  formatLoanType,
  formatPaymentFrequency,
  formatSettlementMode,
} from "@/shared/lib/format";

type CreateLoanFormShellProps = {
  lenderId: string;
  initialDate: string;
  clients: ActiveClientOption[];
  dashboardHref: string;
};

const fixedFrequencyOptions = [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
] as const;

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
  lenderId,
  initialDate,
  clients,
  dashboardHref,
}: CreateLoanFormShellProps) {
  const maxStartDate = useMemo(() => toDateInputValue(new Date()), []);
  const [loanType, setLoanType] = useState<"FIXED_INSTALLMENTS" | "MONTHLY_INTEREST">(
    "FIXED_INSTALLMENTS",
  );
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [monthlyInterestRate, setMonthlyInterestRate] = useState("0.15");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [paymentFrequency, setPaymentFrequency] = useState<
    "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY"
  >("WEEKLY");
  const [earlySettlementInterestMode, setEarlySettlementInterestMode] = useState<
    "FULL_MONTH" | "PRORATED_BY_DAYS"
  >("FULL_MONTH");
  const [startDate, setStartDate] = useState(initialDate);
  const [expectedEndDate, setExpectedEndDate] = useState("");
  const [submitState, setSubmitState] = useState<
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "error"; message: string }
    | { status: "success"; data: CreateLoanResponse }
  >({ status: "idle" });
  const submitLockRef = useRef(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clients, clientId],
  );

  const previewTypeLabel = formatLoanType(loanType);
  const previewPrincipal = Number(principalAmount || 0);
  const previewInstallment = Number(installmentAmount || 0);
  const isSubmitDisabled =
    submitState.status === "submitting" ||
    submitState.status === "success" ||
    clients.length === 0;

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
      const rate = Number(monthlyInterestRate);

      if (!Number.isFinite(rate) || rate < 0) {
        setSubmitState({
          status: "error",
          message: "Ingresa una tasa mensual valida.",
        });
        return;
      }
    }

    submitLockRef.current = true;
    setSubmitState({ status: "submitting" });

    const result = await createLoan({
      lenderId,
      clientId,
      type: loanType,
      principalAmount: previewPrincipal,
      monthlyInterestRate:
        loanType === "MONTHLY_INTEREST" ? Number(monthlyInterestRate) : undefined,
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

  return (
    <main className="page-shell">
      <ContextHeader
        backHref={dashboardHref}
        backLabel="Volver al dashboard"
        title="Nuevo prestamo"
        subtitle="Alta operativa del credito"
      />

      <section className="panel gap-4">
        <div className="space-y-2">
          <p className="eyebrow">Nuevo prestamo</p>
          <h1 className="text-[2rem] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
            Abrir credito
          </h1>
          <p className="max-w-[22rem] text-sm leading-6 text-[var(--muted)]">
            Formulario operativo para crear prestamos sin mover calculos al frontend.
          </p>
        </div>

        <div className="rounded-[1.25rem] bg-[var(--surface)] p-4">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
            Cliente seleccionado
          </p>
          <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
            {selectedClient?.fullName ?? "Sin cliente"}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {selectedClient
              ? `Documento ${selectedClient.documentNumber}`
              : "Selecciona un cliente activo del prestamista."}
          </p>
        </div>
      </section>

      <section className="panel gap-4">
        <div>
          <p className="eyebrow">Formulario</p>
          <h2 className="section-title">Datos base</h2>
        </div>

        {clients.length === 0 ? (
          <div className="empty-panel">
            No hay clientes activos para este prestamista. Primero crea un cliente.
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={handleSubmit}
            onKeyDown={preventImplicitSubmit}
          >
            <label className="surface-field">
              <span className="surface-label">Cliente</span>
              <select
                className="surface-input"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.fullName} · {client.documentNumber}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-3">
              <p className="surface-label">Tipo de prestamo</p>
              <div className="flex flex-wrap gap-2">
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

            <div className="grid gap-3">
              <label className="surface-field">
                <span className="surface-label">Monto prestado</span>
                <input
                  className="surface-input text-2xl font-semibold"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={principalAmount}
                  onChange={(event) =>
                    setPrincipalAmount(sanitizeIntegerInput(event.target.value))
                  }
                  autoComplete="off"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-4 rounded-[1.25rem] bg-[var(--surface)] p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="surface-field">
                    <span className="surface-label">Valor de cuota</span>
                    <input
                      className="surface-input"
                      type="text"
                      inputMode="numeric"
                      value={installmentAmount}
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

                <label className="surface-field">
                  <span className="surface-label">Frecuencia</span>
                  <select
                    className="surface-input"
                    value={paymentFrequency}
                    onChange={(event) =>
                      setPaymentFrequency(
                        event.target.value as
                          | "DAILY"
                          | "WEEKLY"
                          | "BIWEEKLY"
                          | "MONTHLY",
                      )
                    }
                  >
                    {fixedFrequencyOptions.map((frequency) => (
                      <option key={frequency} value={frequency}>
                        {formatPaymentFrequency(frequency)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div className="space-y-4 rounded-[1.25rem] bg-[var(--surface)] p-4">
                <label className="surface-field">
                  <span className="surface-label">Tasa mensual</span>
                  <input
                    className="surface-input"
                    type="text"
                    inputMode="decimal"
                    value={monthlyInterestRate}
                    onChange={(event) =>
                      setMonthlyInterestRate(
                        sanitizeDecimalInput(event.target.value),
                      )
                    }
                    autoComplete="off"
                  />
                </label>

                <label className="surface-field">
                  <span className="surface-label">Liquidacion anticipada</span>
                  <select
                    className="surface-input"
                    value={earlySettlementInterestMode}
                    onChange={(event) =>
                      setEarlySettlementInterestMode(
                        event.target.value as "FULL_MONTH" | "PRORATED_BY_DAYS",
                      )
                    }
                  >
                    <option value="FULL_MONTH">Mes completo</option>
                    <option value="PRORATED_BY_DAYS">Prorrateado por dias</option>
                  </select>
                </label>

                <p className="text-sm leading-6 text-[var(--muted)]">
                  La frecuencia para interes mensual queda fija en{" "}
                  {formatPaymentFrequency("MONTHLY")}.
                </p>
              </div>
            )}

            <section className="rounded-[1.35rem] border border-[var(--line)] bg-[var(--surface)] p-4">
              <p className="eyebrow">Resumen</p>
              <div className="mt-3 space-y-2 text-sm text-[var(--muted)]">
                <p>
                  Tipo:{" "}
                  <strong className="text-[var(--foreground)]">{previewTypeLabel}</strong>
                </p>
                <p>
                  Capital:{" "}
                  <strong className="text-[var(--foreground)]">
                    {formatCurrency(previewPrincipal)}
                  </strong>
                </p>
                {loanType === "FIXED_INSTALLMENTS" ? (
                  <>
                    <p>
                      Cuota:{" "}
                      <strong className="text-[var(--foreground)]">
                        {formatCurrency(previewInstallment)}
                      </strong>
                    </p>
                    <p>
                      Frecuencia:{" "}
                      <strong className="text-[var(--foreground)]">
                        {formatPaymentFrequency(paymentFrequency)}
                      </strong>
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Tasa mensual:{" "}
                      <strong className="text-[var(--foreground)]">
                        {monthlyInterestRate}
                      </strong>
                    </p>
                    <p>
                      Liquidacion:{" "}
                      <strong className="text-[var(--foreground)]">
                        {formatSettlementMode(earlySettlementInterestMode)}
                      </strong>
                    </p>
                  </>
                )}
              </div>
            </section>

            {submitState.status === "error" ? (
              <div className="rounded-[1.1rem] border border-[var(--danger-soft)] bg-[var(--danger-soft)]/55 p-4 text-sm text-[var(--foreground)]">
                {submitState.message}
              </div>
            ) : null}

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Link className="surface-button text-center" href={dashboardHref}>
                Cancelar
              </Link>
              <button
                className="surface-button"
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
        )}
      </section>

      {submitState.status === "success" ? (
        <section className="panel gap-4">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2 className="section-title">Prestamo creado</h2>
          </div>

          <div className="rounded-[1.25rem] bg-[var(--success-soft)] p-4">
            <p className="text-sm leading-6 text-[var(--foreground)]">
              Se abrio un prestamo de {formatCurrency(submitState.data.principalAmount)} para{" "}
              {submitState.data.client.fullName}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[1.1rem] bg-[var(--surface)] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                Tipo
              </p>
              <p className="mt-1 font-semibold text-[var(--foreground)]">
                {formatLoanType(submitState.data.type)}
              </p>
            </div>
            <div className="rounded-[1.1rem] bg-[var(--surface)] p-3">
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                Estado
              </p>
              <p className="mt-1 font-semibold text-[var(--foreground)]">
                {submitState.data.status}
              </p>
            </div>
          </div>

          <Link
            className="surface-button text-center"
            href={`/loans/${submitState.data.id}?lenderId=${encodeURIComponent(lenderId)}&date=${encodeURIComponent(startDate)}`}
          >
            Ir al prestamo
          </Link>
        </section>
      ) : null}
    </main>
  );
}
