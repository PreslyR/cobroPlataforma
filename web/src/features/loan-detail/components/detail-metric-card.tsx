import styles from "./detail-metric-card.module.css";

type DetailMetricCardProps = {
  label: string;
  value: string;
  meta?: string;
  tone?: "neutral" | "warning" | "danger" | "brand";
};

export function DetailMetricCard({
  label,
  value,
  meta,
  tone = "neutral",
}: DetailMetricCardProps) {
  const pillClass =
    tone === "danger"
      ? styles.pillDanger
      : tone === "warning"
        ? styles.pillWarning
        : tone === "brand"
          ? styles.pillBrand
          : styles.pillNeutral;

  return (
    <article className={styles.card}>
      <p className={`${styles.pill} ${pillClass}`}>{label}</p>
      <p className={styles.value}>{value}</p>
      {meta ? <p className={styles.meta}>{meta}</p> : null}
    </article>
  );
}
