import styles from "./metric-card.module.css";

type MetricCardProps = {
  label: string;
  value: string;
  meta: string;
  tone: "brand" | "danger" | "warning" | "success" | "neutral";
  variant?: "default" | "embedded";
};

const toneStyles: Record<MetricCardProps["tone"], string> = {
  brand: styles.pillBrand,
  danger: styles.pillDanger,
  warning: styles.pillWarning,
  success: styles.pillSuccess,
  neutral: styles.pillNeutral,
};

export function MetricCard({
  label,
  value,
  meta,
  tone,
  variant = "default",
}: MetricCardProps) {
  const variantClass =
    variant === "embedded" ? styles.embeddedVariant : styles.defaultVariant;

  return (
    <article className={`${styles.card} ${variantClass}`}>
      <div className={`${styles.pill} ${toneStyles[tone]}`}>{label}</div>
      <p className={styles.value}>{value}</p>
      <p className={styles.meta}>{meta}</p>
    </article>
  );
}
