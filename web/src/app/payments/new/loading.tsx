export default function NewPaymentLoading() {
  return (
    <main className="page-shell">
      <section className="panel gap-4">
        <div className="h-5 w-32 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        <div className="h-10 w-56 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        <div className="h-24 animate-pulse rounded-[1.35rem] bg-[var(--surface-strong)]" />
      </section>

      <section className="panel gap-3">
        <div className="h-64 animate-pulse rounded-[1.35rem] bg-[var(--surface-strong)]" />
      </section>
    </main>
  );
}
