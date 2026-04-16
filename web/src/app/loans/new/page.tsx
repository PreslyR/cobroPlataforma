import { CreateLoanFormShell } from "@/features/loans/components/create-loan-form-shell";

type SearchParams = Promise<{
  date?: string | string[];
}>;

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildQueryString(values: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const date =
    getSingleParam(resolvedSearchParams.date) ??
    toDateInputValue(new Date());
  const dashboardHref = `/${buildQueryString({ date })}`;

  return (
    <CreateLoanFormShell
      initialDate={date}
      dashboardHref={dashboardHref}
    />
  );
}
