export default function ClientDetailLoading() {
  return (
    <main className="page-shell">
      <section className="panel gap-4">
        <p className="eyebrow">Detalle de cliente</p>
        <div className="h-8 w-56 animate-pulse rounded-full bg-[var(--surface-strong)]" />
        <div className="h-20 animate-pulse rounded-[1.25rem] bg-[var(--surface-strong)]" />
      </section>

      <section className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="panel h-28 animate-pulse rounded-[1.35rem] bg-[var(--surface-strong)]"
          />
        ))}
      </section>

      <section className="panel gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[1.2rem] bg-[var(--surface-strong)]"
          />
        ))}
      </section>
    </main>
  );
}
