type MetricCardProps = {
  label: string;
  value: string;
  meta: string;
  tone: "brand" | "danger" | "warning" | "success" | "neutral";
};

const toneStyles: Record<MetricCardProps["tone"], string> = {
  brand: "bg-[var(--brand-soft)] text-[var(--brand)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  neutral: "bg-[var(--surface-strong)] text-[var(--foreground)]",
};

export function MetricCard({ label, value, meta, tone }: MetricCardProps) {
  return (
    <article className="panel gap-2 rounded-[1.35rem] p-4">
      <div className={`w-fit rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] ${toneStyles[tone]}`}>
        {label}
      </div>
      <p className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      <p className="text-sm text-[var(--muted)]">{meta}</p>
    </article>
  );
}
