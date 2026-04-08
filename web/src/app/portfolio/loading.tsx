export default function PortfolioLoading() {
  return (
    <main className="page-shell">
      <section className="panel gap-4">
        <p className="eyebrow">Cartera</p>
        <div className="h-8 w-44 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        <div className="h-4 w-full animate-pulse rounded-xl bg-[var(--surface-strong)]" />
      </section>

      <section className="panel gap-3">
        <div className="h-20 animate-pulse rounded-[1.35rem] bg-[var(--surface-strong)]" />
      </section>

      <section className="panel gap-3">
        <div className="h-40 animate-pulse rounded-[1.35rem] bg-[var(--surface-strong)]" />
        <div className="h-40 animate-pulse rounded-[1.35rem] bg-[var(--surface-strong)]" />
      </section>
    </main>
  );
}
