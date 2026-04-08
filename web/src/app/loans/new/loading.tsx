export default function NewLoanLoading() {
  return (
    <main className="page-shell">
      <section className="panel gap-4">
        <div className="h-5 w-32 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        <div className="h-10 w-56 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        <div className="h-20 animate-pulse rounded-[1.35rem] bg-[var(--surface-strong)]" />
      </section>

      <section className="panel gap-3">
        <div className="h-96 animate-pulse rounded-[1.35rem] bg-[var(--surface-strong)]" />
      </section>
    </main>
  );
}
