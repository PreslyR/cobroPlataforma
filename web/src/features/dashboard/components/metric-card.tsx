type MetricCardProps = {
  label: string;
  value: string;
  meta: string;
  tone: "brand" | "danger" | "warning" | "success" | "neutral";
};

const toneStyles: Record<MetricCardProps["tone"], string> = {
  brand: "metric-card-pill-brand",
  danger: "metric-card-pill-danger",
  warning: "metric-card-pill-warning",
  success: "metric-card-pill-success",
  neutral: "metric-card-pill-neutral",
};

export function MetricCard({ label, value, meta, tone }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className={`metric-card-pill ${toneStyles[tone]}`}>{label}</div>
      <p className="metric-card-value">{value}</p>
      <p className="metric-card-meta">{meta}</p>
    </article>
  );
}
