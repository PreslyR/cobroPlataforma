import Link from "next/link";

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
  const toneClass =
    tone === "brand"
      ? "border-[color:rgba(13,94,91,0.15)] bg-[var(--brand-soft)]/65"
      : tone === "warning"
        ? "border-[color:rgba(165,92,24,0.15)] bg-[var(--warning-soft)]/70"
        : "border-[var(--line)] bg-[var(--surface)]";

  return (
    <div className={`rounded-[1.35rem] border p-4 ${toneClass}`}>
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      {amount ? (
        <p className="mt-2 text-[1.65rem] font-semibold leading-none tracking-tight text-[var(--foreground)]">
          {amount}
        </p>
      ) : null}
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{description}</p>
      {href && ctaLabel ? (
        <Link
          className="card-cta mt-4 inline-flex items-center"
          href={href}
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
