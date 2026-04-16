import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className="panel gap-4">
        <p className="eyebrow">Cobro</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Operacion del prestamista
        </h1>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Accede con tu cuenta del sistema para abrir inicio, cartera, clientes
          y reportes sin depender de `lenderId` en la URL.
        </p>
      </section>

      <LoginForm />
    </main>
  );
}
