"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  fetchBackendFromBrowser,
  getBrowserBackendBaseUrl,
} from "@/shared/lib/api/browser-backend";
import styles from "./login-form.module.css";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "submitting" }
    | { status: "error"; message: string }
  >({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setState({
        status: "error",
        message: "Ingresa correo y contrasena.",
      });
      return;
    }

    setState({ status: "submitting" });
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setState({
        status: "error",
        message: error.message,
      });
      return;
    }

    try {
      const response = await fetchBackendFromBrowser("/auth/me", {
        cache: "no-store",
      });

      if (!response.ok) {
        await supabase.auth.signOut();
        setState({
          status: "error",
          message:
            "La cuenta existe en Supabase Auth, pero no tiene un usuario interno ADMIN activo asociado.",
        });
        return;
      }
    } catch (error) {
      await supabase.auth.signOut();
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : `No se pudo validar la sesion contra ${getBrowserBackendBaseUrl()}.`,
      });
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Iniciar sesion</h1>
        </div>

        <div className={styles.badge} aria-hidden="true">
          <span className={styles.badgeCore}>
            <svg
              className={styles.badgeIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7.5 10.5V8a4.5 4.5 0 1 1 9 0v2.5" />
              <rect x="5.5" y="10.5" width="13" height="10" rx="2.5" />
            </svg>
          </span>
        </div>
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span className={styles.label}>Correo</span>
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="prestamista@negocio.com"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Contrasena</span>
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu acceso"
          />
        </label>
      </div>

      {state.status === "error" ? (
        <div className={styles.errorBox}>{state.message}</div>
      ) : null}

      <button
        className={styles.submit}
        type="submit"
        disabled={state.status === "submitting"}
      >
        <span className={styles.submitLabel}>
          {state.status === "submitting" ? "Entrando..." : "Entrar"}
        </span>
      </button>
    </form>
  );
}
