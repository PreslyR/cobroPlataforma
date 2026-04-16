import styles from "./home.module.css";

export default function Loading() {
  return (
    <main className={`page-shell ${styles.pageShellHome}`}>
      <section className={styles.homeHeroBand}>
        <div className="min-h-[136px] animate-pulse rounded-[1.75rem] bg-transparent" />
      </section>

      <section className={styles.homeHeroSummary}>
        <div className="panel min-h-[188px] animate-pulse bg-[var(--surface)]" />
      </section>

      <section className="panel animate-pulse bg-[var(--surface)]">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[106px] rounded-2xl border border-[var(--line)] bg-[var(--surface-strong)]"
            />
          ))}
        </div>
      </section>

      <section className="panel min-h-[104px] animate-pulse bg-[var(--surface)]" />
      <section className="panel min-h-[198px] animate-pulse bg-[var(--surface)]" />
      <section className="panel min-h-[236px] animate-pulse bg-[var(--surface)]" />
    </main>
  );
}
