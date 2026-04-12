"use client";

import { ActiveClientOption } from "@/features/loans/types";
import styles from "./create-loan-form-shell.module.css";

type ClientsState =
  | { status: "idle"; data: ActiveClientOption[] }
  | { status: "loading"; data: ActiveClientOption[] }
  | { status: "ready"; data: ActiveClientOption[] }
  | { status: "error"; data: ActiveClientOption[]; message: string };

type ClientPickerDialogProps = {
  isOpen: boolean;
  clientId: string;
  clientSearch: string;
  clientsState: ClientsState;
  filteredClients: ActiveClientOption[];
  availableClientsCount: number;
  onClose: () => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (client: ActiveClientOption) => void;
};

export function ClientPickerDialog({
  isOpen,
  clientId,
  clientSearch,
  clientsState,
  filteredClients,
  availableClientsCount,
  onClose,
  onRetry,
  onSearchChange,
  onSelect,
}: ClientPickerDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.clientPickerOverlay}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.clientPickerCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.clientPickerHeader}>
          <div>
            <p className="eyebrow">Clientes</p>
            <h2 className="section-title" id="client-picker-title">
              Seleccionar cliente
            </h2>
          </div>
          <button
            className={styles.clientPickerClose}
            type="button"
            onClick={onClose}
            aria-label="Cerrar selector de clientes"
          >
            <svg
              className={styles.clientPickerCloseIcon}
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 6L18 18" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <label className="surface-field">
          <span className="surface-label">Buscar</span>
          <input
            className="surface-input"
            type="text"
            placeholder="Nombre, cedula o telefono"
            value={clientSearch}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className={styles.clientPickerList}>
          {clientsState.status === "loading" ? (
            <div className={styles.clientPickerEmpty}>Cargando clientes...</div>
          ) : clientsState.status === "error" ? (
            <div className={styles.clientPickerEmpty}>
              <p>No pude cargar los clientes.</p>
              <p>{clientsState.message}</p>
              <button
                className={styles.advancedToggle}
                type="button"
                onClick={onRetry}
              >
                Reintentar
              </button>
            </div>
          ) : filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <button
                key={client.id}
                className={`${styles.clientPickerItem} ${
                  client.id === clientId ? styles.clientPickerItemActive : ""
                }`}
                type="button"
                onClick={() => onSelect(client)}
              >
                <div className={styles.clientPickerItemCopy}>
                  <p className={styles.clientPickerItemName}>{client.fullName}</p>
                  <p className={styles.clientPickerItemMeta}>
                    C.C. {client.documentNumber}
                    {client.phone ? ` | ${client.phone}` : ""}
                  </p>
                </div>
                <span className={styles.clientPickerItemChevron} aria-hidden="true">
                  {">"}
                </span>
              </button>
            ))
          ) : (
            <div className={styles.clientPickerEmpty}>
              {availableClientsCount > 0
                ? "No encontre clientes con esa busqueda."
                : "No hay clientes activos para este prestamista."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
