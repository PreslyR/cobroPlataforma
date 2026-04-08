"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ActionLauncherProps = {
  paymentHref: string;
  newLoanHref: string;
  variant: "mobile" | "desktop";
};

export function ActionLauncher({
  paymentHref,
  newLoanHref,
  variant,
}: ActionLauncherProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (variant !== "mobile") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, variant]);

  if (variant === "mobile") {
    return (
      <>
        {open ? (
          <button
            className="action-launcher-overlay"
            type="button"
            aria-label="Cerrar acciones"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <div className="action-launcher-mobile">
          {open ? (
            <div className="action-launcher-sheet">
              <Link
                className="action-sheet-link"
                href={paymentHref}
                onClick={() => setOpen(false)}
              >
                <span className="action-sheet-label">Registrar pago</span>
                <span className="action-sheet-icon-wrap">
                  <svg className="action-sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                    <path d="M12 3.75v16.5" />
                    <path d="M6.75 9 12 3.75 17.25 9" />
                    <path d="M5.25 20.25h13.5" />
                  </svg>
                </span>
              </Link>
              <Link
                className="action-sheet-link"
                href={newLoanHref}
                onClick={() => setOpen(false)}
              >
                <span className="action-sheet-label">Nuevo prestamo</span>
                <span className="action-sheet-icon-wrap">
                  <svg className="action-sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                    <path d="M12 5.25v13.5" />
                    <path d="M5.25 12h13.5" />
                  </svg>
                </span>
              </Link>
            </div>
          ) : null}

          <button
            className="action-launcher-fab"
            type="button"
            aria-expanded={open}
            aria-label={open ? "Cerrar acciones" : "Abrir acciones"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="action-launcher-fab-core">
              <svg
                className={`action-launcher-fab-icon ${open ? "action-launcher-fab-icon-open" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <path d="M12 5.25v13.5" />
                <path d="M5.25 12h13.5" />
              </svg>
            </span>
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="action-launcher action-launcher-desktop">
      <Link className="action-launcher-link action-launcher-link-brand" href={paymentHref}>
        Registrar pago
      </Link>
      <Link className="action-launcher-link" href={newLoanHref}>
        Nuevo prestamo
      </Link>
    </div>
  );
}
