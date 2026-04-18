"use client";

import { useEffect, useState } from "react";
import styles from "./client-detail-hero.module.css";

type ClientDetailHeroProps = {
  fullName: string;
  documentNumber: string;
  email: string | null;
  phone: string | null;
  lenderName: string;
  address: string | null;
  notes: string | null;
  dateLabel: string;
};

export function ClientDetailHero({
  fullName,
  documentNumber,
  email,
  phone,
  lenderName,
  address,
  notes,
  dateLabel,
}: ClientDetailHeroProps) {
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
            <p className="eyebrow">Detalle de cliente</p>
            <button
              className={styles.heroTrigger}
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <span className={styles.heroTriggerText}>{fullName}</span>
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
            <p className={styles.heroSubtitle}>C.C. {documentNumber}</p>
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
          aria-labelledby="client-sheet-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className={styles.sheetHandle} aria-hidden="true" />

          <div className={styles.sheetHeader}>
            <div>
              <p className="eyebrow">Ficha del cliente</p>
              <h2 className={styles.sheetTitle} id="client-sheet-title">
                {fullName}
              </h2>
            </div>
            <button
              className={styles.sheetClose}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar ficha del cliente"
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
              <span className={styles.sheetLabel}>Documento</span>
              <strong className={styles.sheetValue}>C.C. {documentNumber}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Correo</span>
              <strong className={styles.sheetValue}>{email || "Sin correo"}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Telefono</span>
              <strong className={styles.sheetValue}>{phone || "Sin telefono"}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Prestamista</span>
              <strong className={styles.sheetValue}>{lenderName}</strong>
            </div>
            <div className={styles.sheetRow}>
              <span className={styles.sheetLabel}>Direccion</span>
              <strong className={styles.sheetValue}>{address || "Sin direccion"}</strong>
            </div>
            {notes ? (
              <div className={styles.sheetRow}>
                <span className={styles.sheetLabel}>Notas</span>
                <strong className={styles.sheetValue}>{notes}</strong>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
