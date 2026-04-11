import styles from "./reports.module.css";

export default function ReportsLoading() {
  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <section className={styles.loadingPanel}>
        <div className={styles.loadingHeroBlock} />
        <div className={styles.loadingMetrics}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={styles.loadingMetric} />
          ))}
        </div>
      </section>

      <section className={styles.loadingPanel}>
        <div className={styles.loadingHeroBlock} />
        <div className={styles.loadingMetrics}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className={styles.loadingMetric} />
          ))}
        </div>
      </section>

      <section className={styles.loadingPanel}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.loadingCard} />
        ))}
      </section>
    </main>
  );
}