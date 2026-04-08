export default function Loading() {
  return (
    <main className="page-shell">
      <section className="hero-panel min-h-[210px] animate-pulse" />
      <section className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="panel min-h-[118px] animate-pulse bg-[var(--surface-strong)]"
          />
        ))}
      </section>
      <section className="panel min-h-[180px] animate-pulse bg-[var(--surface-strong)]" />
      <section className="panel min-h-[220px] animate-pulse bg-[var(--surface-strong)]" />
      <section className="panel min-h-[260px] animate-pulse bg-[var(--surface-strong)]" />
    </main>
  );
}
