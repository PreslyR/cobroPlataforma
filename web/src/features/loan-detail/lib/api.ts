import {
  LoanDebtBreakdownResponse,
  LoanDetailPageData,
  LoanDetailRecord,
  LoanPayoffPreviewResponse,
  LoanSummaryResponse,
} from "@/features/loan-detail/types";

type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type LoanDetailBundleResult =
  | {
      ok: true;
      data: LoanDetailPageData;
      meta: { baseUrl: string };
    }
  | {
      ok: false;
      error: string;
      meta: { baseUrl: string };
    };

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api";

async function fetchJson<T>(path: string): Promise<FetchResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `El backend respondió con ${response.status}.`,
      };
    }

    return {
      ok: true,
      data: (await response.json()) as T,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el backend.",
    };
  }
}

export async function getLoanDetailPageData({
  loanId,
  date,
}: {
  loanId: string;
  date?: string;
}): Promise<LoanDetailBundleResult> {
  const searchParams = new URLSearchParams();

  if (date) {
    searchParams.set("asOf", date);
  }

  const payoffSearchParams = new URLSearchParams();
  if (date) {
    payoffSearchParams.set("paymentDate", date);
  }

  const [loanResult, debtBreakdownResult, summaryResult] = await Promise.all([
    fetchJson<LoanDetailRecord>(
      `/loans/${loanId}${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`,
    ),
    fetchJson<LoanDebtBreakdownResponse>(
      `/loans/${loanId}/debt-breakdown${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`,
    ),
    fetchJson<LoanSummaryResponse>(
      `/loans/${loanId}/summary${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`,
    ),
  ]);

  if (!loanResult.ok) {
    return { ok: false, error: loanResult.error, meta: { baseUrl: API_BASE_URL } };
  }

  if (!debtBreakdownResult.ok) {
    return {
      ok: false,
      error: debtBreakdownResult.error,
      meta: { baseUrl: API_BASE_URL },
    };
  }

  if (!summaryResult.ok) {
    return {
      ok: false,
      error: summaryResult.error,
      meta: { baseUrl: API_BASE_URL },
    };
  }

  const payoffFullMonthResult = await fetchJson<LoanPayoffPreviewResponse>(
    `/loans/${loanId}/payoff-preview${
      payoffSearchParams.toString() ? `?${payoffSearchParams.toString()}` : ""
    }`,
  );

  if (!payoffFullMonthResult.ok) {
    return {
      ok: false,
      error: payoffFullMonthResult.error,
      meta: { baseUrl: API_BASE_URL },
    };
  }

  let payoffProrated: LoanPayoffPreviewResponse | null = null;

  if (loanResult.data.type === "MONTHLY_INTEREST") {
    const proratedSearchParams = new URLSearchParams(payoffSearchParams);
    proratedSearchParams.set("mode", "PRORATED_BY_DAYS");

    const payoffProratedResult = await fetchJson<LoanPayoffPreviewResponse>(
      `/loans/${loanId}/payoff-preview?${proratedSearchParams.toString()}`,
    );

    if (!payoffProratedResult.ok) {
      return {
        ok: false,
        error: payoffProratedResult.error,
        meta: { baseUrl: API_BASE_URL },
      };
    }

    payoffProrated = payoffProratedResult.data;
  }

  return {
    ok: true,
    data: {
      loan: loanResult.data,
      debtBreakdown: debtBreakdownResult.data,
      summary: summaryResult.data,
      payoffFullMonth: payoffFullMonthResult.data,
      payoffProrated,
    },
    meta: { baseUrl: API_BASE_URL },
  };
}
