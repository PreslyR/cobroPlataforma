export default function Loading() {
  return (
    <main className="page-shell">
      <section className="panel gap-4 animate-pulse bg-[var(--surface)]">
        <div className="h-3 w-20 rounded-xl bg-[var(--surface-strong)]" />
        <div className="h-8 w-52 rounded-xl bg-[var(--surface-strong)]" />
        <div className="h-4 w-44 rounded-xl bg-[var(--surface-strong)]" />
      </section>

      <section className="panel animate-pulse bg-[var(--surface)]">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[112px] rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)]"
            />
          ))}
        </div>
      </section>

      <section className="panel min-h-[128px] animate-pulse bg-[var(--surface)]" />
      <section className="panel min-h-[200px] animate-pulse bg-[var(--surface)]" />
    </main>
  );
}
