"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignOutButtonProps = {
  variant?: "desktop" | "mobile";
};

function LogoutIcon() {
  return (
    <svg
      aria-hidden="true"
      className="sign-out-trigger-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 16l4-4-4-4" />
      <path d="M14 12H4" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg
      aria-hidden="true"
      className="confirm-modal-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 11.5V5.8a1.3 1.3 0 0 1 2.6 0V10" />
      <path d="M11.1 10V4.8a1.3 1.3 0 0 1 2.6 0V10" />
      <path d="M13.7 10V5.6a1.3 1.3 0 0 1 2.6 0v6.1" />
      <path d="M16.3 10.7V8.4a1.3 1.3 0 0 1 2.6 0v6.1c0 3.7-2.7 5.9-6.1 5.9-2.7 0-4.8-1.4-5.9-3.7L5.2 13a1.5 1.5 0 0 1 2.6-1.5l.7 1.1" />
    </svg>
  );
}

export function SignOutButton({ variant = "desktop" }: SignOutButtonProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmOpen]);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {variant === "mobile" ? (
        <button
          aria-label="Cerrar sesion"
          className="sign-out-trigger sign-out-trigger-mobile"
          type="button"
          onClick={() => setConfirmOpen(true)}
        >
          <LogoutIcon />
        </button>
      ) : (
        <button
          className="inline-link"
          type="button"
          onClick={() => setConfirmOpen(true)}
        >
          Cerrar sesion
        </button>
      )}

      {confirmOpen ? (
        <div
          aria-modal="true"
          className="confirm-modal-overlay"
          role="dialog"
          onClick={() => {
            if (!isSigningOut) {
              setConfirmOpen(false);
            }
          }}
        >
          <div
            className="confirm-modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="confirm-modal-icon-wrap">
              <HandIcon />
            </div>

            <div className="confirm-modal-copy">
              <h2 className="confirm-modal-title">Quieres cerrar sesion?</h2>
              <p className="confirm-modal-subtitle">
                Vas a salir del backoffice del prestamista en este dispositivo.
              </p>
            </div>

            <div className="confirm-modal-actions">
              <button
                className="confirm-modal-button confirm-modal-button-primary"
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Cerrando..." : "Si"}
              </button>
              <button
                className="confirm-modal-button"
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isSigningOut}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
