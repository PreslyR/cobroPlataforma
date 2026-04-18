"use client";

import { useState } from "react";
import { approveClientIntakeSubmissionAction, rejectClientIntakeSubmissionAction } from "@/app/clients/actions";
import { ClientIntakeSubmission } from "@/features/clients/types";
import { formatDateShort } from "@/shared/lib/format";
import styles from "./client-intake-card.module.css";

type ClientIntakeCardProps = {
  item: ClientIntakeSubmission;
  date: string;
  search: string;
};

function getDuplicateFlags(item: ClientIntakeSubmission) {
  const flags: Array<{ label: string; danger?: boolean }> = [];

  if (item.duplicateByDocument) {
    flags.push({ label: "Documento repetido", danger: true });
  }

  if (item.duplicateByEmail) {
    flags.push({ label: "Email repetido", danger: true });
  }

  if (item.duplicateByPhone) {
    flags.push({ label: "Telefono repetido", danger: true });
  }

  if (flags.length === 0) {
    flags.push({ label: "Sin duplicados" });
  }

  return flags;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className={`${styles.chevronIcon} ${open ? styles.chevronIconOpen : ""}`}
    >
      <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ApproveIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 10.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RejectIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l8 8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6l-8 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClientIntakeCard({
  item,
  date,
  search,
}: ClientIntakeCardProps) {
  const [open, setOpen] = useState(false);
  const flags = getDuplicateFlags(item);

  return (
    <article className={styles.card}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div className={styles.head}>
          <div className={styles.copy}>
            <p className={styles.name}>{item.fullName}</p>
            <p className={styles.meta}>C.C. {item.documentNumber}</p>
            <p className={styles.meta}>Recibido {formatDateShort(item.submittedAt)}</p>
          </div>

          <div className={styles.headSide}>
            <div className={styles.status}>Pendiente</div>
            <ChevronIcon open={open} />
          </div>
        </div>

        <div className={styles.flags}>
          {flags.map((flag) => (
            <span
              key={flag.label}
              className={`${styles.flag} ${flag.danger ? styles.flagDanger : ""}`}
            >
              {flag.label}
            </span>
          ))}
        </div>
      </button>

      {open ? (
        <div className={styles.expanded}>
          <div className={styles.details}>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>Telefono</span>
              <span className={styles.detailValue}>{item.phone ?? "Sin dato"}</span>
            </div>
            <div className={styles.detail}>
              <span className={styles.detailLabel}>Email</span>
              <span className={styles.detailValue}>{item.email ?? "Sin dato"}</span>
            </div>
            <div className={`${styles.detail} ${styles.detailWide}`}>
              <span className={styles.detailLabel}>Direccion</span>
              <span className={styles.detailValue}>{item.address ?? "Sin dato"}</span>
            </div>
            {item.notes ? (
              <div className={`${styles.detail} ${styles.detailWide}`}>
                <span className={styles.detailLabel}>Observaciones</span>
                <span className={styles.detailValue}>{item.notes}</span>
              </div>
            ) : null}
          </div>

          <div className={styles.actions}>
            <form action={rejectClientIntakeSubmissionAction} className={styles.actionForm}>
              <input type="hidden" name="submissionId" value={item.id} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="search" value={search} />
              <input type="hidden" name="tab" value="pending" />
              <button
                className={`${styles.actionButton} ${styles.rejectButton}`}
                type="submit"
                aria-label={`Rechazar solicitud de ${item.fullName}`}
                title="Rechazar"
              >
                <RejectIcon />
              </button>
            </form>

            <form action={approveClientIntakeSubmissionAction} className={styles.actionForm}>
              <input type="hidden" name="submissionId" value={item.id} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="search" value={search} />
              <input type="hidden" name="tab" value="pending" />
              <button
                className={`${styles.actionButton} ${styles.approveButton}`}
                type="submit"
                aria-label={`Aprobar solicitud de ${item.fullName}`}
                title="Aprobar"
              >
                <ApproveIcon />
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </article>
  );
}
