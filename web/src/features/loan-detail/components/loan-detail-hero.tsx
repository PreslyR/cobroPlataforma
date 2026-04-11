"use client";

import { useEffect, useState } from "react";
import styles from "./loan-detail-hero.module.css";

type LoanDetailHeroProps = {
  clientFullName: string;
  clientDocumentNumber: string;
  loanTypeLabel: string;
  lenderName: string;
  loanStatusLabel: string;
  startDateLabel: string;
  paymentFrequencyLabel: string;
  principalAmountLabel: string;
  expectedEndDateLabel: string;
  dateLabel: string;
  loanIdShort: string;
  installmentAmountLabel?: string | null;
  totalInstallments?: number | null;
  monthlyInterestRateLabel?: string | null;
  earlySettlementModeLabel?: string | null;
};

export function LoanDetailHero({
  clientFullName,
  clientDocumentNumber,
  loanTypeLabel,
  lenderName,
  loanStatusLabel,
  startDateLabel,
  paymentFrequencyLabel,
  principalAmountLabel,
  expectedEndDateLabel,
  dateLabel,
  loanIdShort,
  installmentAmountLabel,
  totalInstallments,
  monthlyInterestRateLabel,
  earlySettlementModeLabel,
}: LoanDetailHeroProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Ficha operativa</p>
            <button
              className={styles.heroTrigger}
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <span className={styles.heroTriggerText}>{clientFullName}</span>
              <svg
                className={styles.heroTriggerIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <p className={styles.heroSubtitle}>
              {loanTypeLabel} | Documento {clientDocumentNumber}
            </p>
          </div>

          <div className={styles.heroDate}>
            <p className={styles.heroDateLabel}>Fecha de corte</p>
            <p className={styles.heroDateValue}>{dateLabel}</p>
          </div>
        </div>
      </section>

      <div
        className={`${styles.sheetOverlay} ${open ? styles.sheetOverlayOpen : ""}`}
        role="presentation"
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      >
        <section
          className={`${styles.sheet} ${open ? styles.sheetOpen : ""}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="loan-sheet-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.sheetHandle} aria-hidden="true" />

          <div className={styles.sheetHeader}>
            <div>
              <p className="eyebrow">Ficha tecnica</p>
              <h2 className={styles.sheetTitle} id="loan-sheet-title">
                {loanTypeLabel}
              </h2>
            </div>
            <button
              className={styles.sheetClose}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar ficha tecnica del prestamo"
            >
              <svg
                className={styles.sheetCloseIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className={styles.sheetGrid}>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Prestamista</span>
              <strong className={styles.sheetValue}>{lenderName}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Estado</span>
              <strong className={styles.sheetValue}>{loanStatusLabel}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Fecha de inicio</span>
              <strong className={styles.sheetValue}>{startDateLabel}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Frecuencia</span>
              <strong className={styles.sheetValue}>{paymentFrequencyLabel}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Monto original</span>
              <strong className={styles.sheetValue}>{principalAmountLabel}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Cierre esperado</span>
              <strong className={styles.sheetValue}>{expectedEndDateLabel}</strong>
            </div>
            {installmentAmountLabel ? (
              <div className={styles.sheetRow}>
                <span className={styles.sheetLabel}>Valor de cuota</span>
                <strong className={styles.sheetValue}>{installmentAmountLabel}</strong>
              </div>
            ) : null}
            {totalInstallments !== null && totalInstallments !== undefined ? (
              <div className={styles.sheetRow}>
                <span className={styles.sheetLabel}>Total de cuotas</span>
                <strong className={styles.sheetValue}>{totalInstallments}</strong>
              </div>
            ) : null}
            {monthlyInterestRateLabel ? (
              <div className={styles.sheetRow}>
                <span className={styles.sheetLabel}>Tasa mensual</span>
                <strong className={styles.sheetValue}>{monthlyInterestRateLabel}</strong>
              </div>
            ) : null}
            {earlySettlementModeLabel ? (
              <div className={styles.sheetRow}>
                <span className={styles.sheetLabel}>Liquidacion anticipada</span>
                <strong className={styles.sheetValue}>{earlySettlementModeLabel}</strong>
              </div>
            ) : null}
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Id del prestamo</span>
              <strong className={styles.sheetValue}>{loanIdShort}</strong>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}