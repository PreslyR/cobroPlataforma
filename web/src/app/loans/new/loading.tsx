import styles from "./new-loan.module.css";

export default function NewLoanLoading() {
  return (
    <main className={`page-shell ${styles.pageShell}`}>
      <section className={styles.loadingPanel}>
        <div className={styles.loadingHeroBlock} />
        <div className={styles.loadingHeroBlock} />
      </section>

      <section className={styles.loadingPanel}>
        <div className={styles.loadingCard} />
      </section>
    </main>
  );
}