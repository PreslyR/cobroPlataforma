import Link from "next/link";

type QuickActionCardProps = {
  title: string;
  description: string;
  href: string;
  accent: "brand" | "warning" | "neutral";
};

const accentStyles: Record<QuickActionCardProps["accent"], string> = {
  brand: "from-[var(--brand-soft)] to-white text-[var(--brand)]",
  warning: "from-[var(--warning-soft)] to-white text-[var(--warning)]",
  neutral: "from-[var(--surface-strong)] to-white text-[var(--foreground)]",
};

export function QuickActionCard({
  title,
  description,
  href,
  accent,
}: QuickActionCardProps) {
  return (
    <Link
      className={`rounded-[1.35rem] border border-[var(--line)] bg-linear-to-br ${accentStyles[accent]} p-4 shadow-[0_12px_28px_rgba(29,42,48,0.06)] transition-transform duration-150 hover:-translate-y-0.5`}
      href={href}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/75">
        {description}
      </p>
      <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.12em]">
        Abrir
      </span>
    </Link>
  );
}
