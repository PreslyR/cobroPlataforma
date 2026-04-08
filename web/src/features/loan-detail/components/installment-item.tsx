import {
  formatCurrency,
  formatDateShort,
  formatInstallmentStatus,
} from "@/shared/lib/format";

type InstallmentItemProps = {
  installment: {
    id: string;
    installmentNumber: number;
    dueDate: string;
    amount: number;
    status: "PENDING" | "LATE" | "PAID";
  };
  asOfDate: string;
};

function toUtcDateOnly(value: string | Date) {
  const date = new Date(value);

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function diffDaysUtc(startDate: string | Date, endDate: string | Date) {
  const start = toUtcDateOnly(startDate).getTime();
  const end = toUtcDateOnly(endDate).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;

  return Math.max(0, Math.floor((end - start) / msPerDay));
}

function isSameUtcDate(left: string | Date, right: string | Date) {
  return toUtcDateOnly(left).getTime() === toUtcDateOnly(right).getTime();
}

function getInstallmentTone(status: InstallmentItemProps["installment"]["status"]) {
  switch (status) {
    case "PAID":
      return "bg-[var(--success-soft)] text-[var(--success)]";
    case "LATE":
      return "bg-[var(--danger-soft)] text-[var(--danger)]";
    default:
      return "bg-[var(--surface-subtle)] text-[var(--foreground)]";
  }
}

function getInstallmentContext({
  status,
  dueDate,
  asOfDate,
}: {
  status: InstallmentItemProps["installment"]["status"];
  dueDate: string;
  asOfDate: string;
}) {
  if (status === "PAID") {
    return "Cubierta";
  }

  if (isSameUtcDate(dueDate, asOfDate)) {
    return "Vence hoy";
  }

  if (toUtcDateOnly(dueDate) < toUtcDateOnly(asOfDate)) {
    const daysLate = diffDaysUtc(dueDate, asOfDate);
    return `${daysLate} dia(s) de atraso`;
  }

  return "Pendiente";
}

export function InstallmentItem({
  installment,
  asOfDate,
}: InstallmentItemProps) {
  return (
    <article className="rounded-[1.15rem] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Cuota {installment.installmentNumber}
          </p>
          <p className="text-sm text-[var(--muted)]">
            Vence {formatDateShort(installment.dueDate)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.12em] ${getInstallmentTone(
            installment.status,
          )}`}
        >
          {formatInstallmentStatus(installment.status)}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--muted)]">
            Monto
          </p>
          <p className="mt-1 text-2xl font-semibold leading-none tracking-tight text-[var(--foreground)]">
            {formatCurrency(installment.amount)}
          </p>
        </div>
        <p className="text-right text-sm text-[var(--muted)]">
          {getInstallmentContext({
            status: installment.status,
            dueDate: installment.dueDate,
            asOfDate,
          })}
        </p>
      </div>
    </article>
  );
}
