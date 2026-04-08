import Link from "next/link";
import { CreateLoanFormShell } from "@/features/loans/components/create-loan-form-shell";
import { getActiveClients } from "@/features/loans/lib/api";

type SearchParams = Promise<{
  lenderId?: string | string[];
  date?: string | string[];
}>;

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildQueryString(values: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const lenderId =
    getSingleParam(resolvedSearchParams.lenderId) ??
    process.env.NEXT_PUBLIC_DEFAULT_LENDER_ID ??
    "";
  const date =
    getSingleParam(resolvedSearchParams.date) ??
    toDateInputValue(new Date());
  const dashboardHref = `/${buildQueryString({ lenderId, date })}`;

  if (!lenderId) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow">Nuevo prestamo</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            Falta definir el prestamista activo.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Agrega <code>lenderId</code> en la URL o define{" "}
            <code>NEXT_PUBLIC_DEFAULT_LENDER_ID</code> en <code>web/.env.local</code>.
          </p>
          <Link className="inline-link" href="/">
            Volver al Dashboard
          </Link>
        </section>
      </main>
    );
  }

  const clientsResult = await getActiveClients(lenderId);

  if (!clientsResult.ok) {
    return (
      <main className="page-shell">
        <section className="panel gap-4">
          <p className="eyebrow text-[var(--danger)]">Clientes no disponibles</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">
            No pude cargar los clientes activos.
          </h1>
          <p className="text-sm leading-6 text-[var(--muted)]">
            Verifica que el backend este corriendo en{" "}
            <code>{clientsResult.meta?.baseUrl ?? "http://localhost:3000/api"}</code>.
          </p>
          <div className="rounded-2xl border border-[var(--danger-soft)] bg-[var(--danger-soft)]/60 p-4 text-sm text-[var(--foreground)]">
            {clientsResult.error}
          </div>
          <Link className="inline-link" href={dashboardHref}>
            Volver al Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <CreateLoanFormShell
      lenderId={lenderId}
      initialDate={date}
      clients={clientsResult.data}
      dashboardHref={dashboardHref}
    />
  );
}
