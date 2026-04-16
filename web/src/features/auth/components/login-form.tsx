"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchBackendFromBrowser, getBrowserBackendBaseUrl } from "@/shared/lib/api/browser-backend";

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
        message: "Ingresa correo y contraseña.",
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
    <form className="panel gap-4" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Acceso</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Iniciar sesion
        </h1>
      </div>

      <p className="text-sm leading-6 text-[var(--muted)]">
        Usa una cuenta creada en Supabase Auth y vinculada a un usuario interno
        activo del sistema.
      </p>

      <label className="surface-field">
        <span className="surface-label">Correo</span>
        <input
          className="surface-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="surface-field">
        <span className="surface-label">Contraseña</span>
        <input
          className="surface-input"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>

      {state.status === "error" ? (
        <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
          {state.message}
        </div>
      ) : null}

      <button
        className="deep-action-button deep-action-button-primary"
        type="submit"
        disabled={state.status === "submitting"}
      >
        <span className="deep-action-button-label">
          {state.status === "submitting" ? "Entrando..." : "Entrar"}
        </span>
      </button>
    </form>
  );
}

