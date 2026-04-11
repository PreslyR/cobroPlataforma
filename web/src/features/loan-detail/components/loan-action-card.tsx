import Link from "next/link";
import styles from "./loan-action-card.module.css";

type LoanActionCardProps = {
  title: string;
  description: string;
  amount?: string;
  href?: string;
  ctaLabel?: string;
  tone?: "neutral" | "warning" | "brand";
};

export function LoanActionCard({
  title,
  description,
  amount,
  href,
  ctaLabel,
  tone = "neutral",
}: LoanActionCardProps) {
  const pillClass =
    tone === "brand"
      ? styles.pillBrand
      : tone === "warning"
        ? styles.pillWarning
        : styles.pillNeutral;

  return (
    <article className={styles.card}>
      <p className={`${styles.pill} ${pillClass}`}>{title}</p>
      {amount ? <p className={styles.amount}>{amount}</p> : null}
      <p className={styles.description}>{description}</p>
      {href && ctaLabel ? (
        <Link className={styles.cta} href={href}>
          {ctaLabel}
        </Link>
      ) : null}
    </article>
  );
}
