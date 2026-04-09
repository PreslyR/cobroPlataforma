import styles from "./client-detail.module.css";

export default function ClientDetailLoading() {
  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <section className={`panel ${styles.hero}`}>
        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Detalle de cliente</p>
            <div className="h-8 w-48 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
            <div className="h-4 w-40 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
          </div>
          <div className={styles.heroDate}>
            <div className="h-3 w-20 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
            <div className="mt-2 h-4 w-28 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
          </div>
        </div>
      </section>

      <section className={styles.controlsPanel}>
        <div className={styles.controlsHeading}>
          <p className="eyebrow">Corte</p>
          <div className="h-4 w-48 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        </div>
        <div className="h-16 animate-pulse rounded-[1rem] bg-[var(--surface-strong)]" />
      </section>

      <section className={styles.summaryGrid}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={styles.summaryCell}>
            <div className="h-3 w-16 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
            <div className="h-6 w-20 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
          </div>
        ))}
      </section>

      <section className={`panel ${styles.section}`}>
        <div className={styles.sectionHeading}>
          <div>
            <p className="eyebrow">Prestamos activos</p>
            <div className="h-7 w-32 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded-xl bg-[var(--surface-strong)]" />
        </div>
        <div className="space-y-3">
          <div className="h-52 animate-pulse rounded-[1.45rem] bg-[var(--surface)] shadow-[0_12px_26px_rgba(19,31,37,0.05)]" />
        </div>
      </section>
    </main>
  );
}