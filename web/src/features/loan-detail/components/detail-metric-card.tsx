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
  const toneClass =
    tone === "danger"
      ? "bg-[var(--danger-soft)]"
      : tone === "warning"
        ? "bg-[var(--warning-soft)]"
        : tone === "brand"
          ? "bg-[var(--brand-soft)]"
          : "bg-[var(--surface)]";

  return (
    <div className={`rounded-[1.25rem] p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold leading-none tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      {meta ? (
        <p className="mt-2 text-sm leading-5 text-[var(--muted)]">{meta}</p>
      ) : null}
    </div>
  );
}
