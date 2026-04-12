import {
  ReportClosedLoansResponse,
  ReportInterestIncomeResponse,
  ReportPaymentsHistoryResponse,
  ReportPenaltyIncomeResponse,
  ReportPortfolioSummaryResponse,
  ReportsPageData,
} from "@/features/reports/types";

type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ReportsPageResult =
  | {
      ok: true;
      data: ReportsPageData;
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
const READ_REVALIDATE_SECONDS = 10;

async function fetchJson<T>(path: string): Promise<FetchResult<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: READ_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `El backend respondio con ${response.status}.`,
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

export async function getReportsPageData({
  lenderId,
  from,
  to,
}: {
  lenderId: string;
  from: string;
  to: string;
}): Promise<ReportsPageResult> {
  const rangeParams = new URLSearchParams({
    lenderId,
    from,
    to,
  });

  const [interestIncome, penaltyIncome, portfolioSummary, paymentsHistory, closedLoans] =
    await Promise.all([
      fetchJson<ReportInterestIncomeResponse>(
        `/reports/interest-income?${rangeParams.toString()}`,
      ),
      fetchJson<ReportPenaltyIncomeResponse>(
        `/reports/penalty-income?${rangeParams.toString()}`,
      ),
      fetchJson<ReportPortfolioSummaryResponse>(
        `/reports/portfolio-summary?asOf=${encodeURIComponent(
          to,
        )}&lenderId=${encodeURIComponent(lenderId)}`,
      ),
      fetchJson<ReportPaymentsHistoryResponse>(
        `/reports/payments-history?${rangeParams.toString()}&limit=20`,
      ),
      fetchJson<ReportClosedLoansResponse>(
        `/reports/closed-loans?${rangeParams.toString()}&limit=20`,
      ),
    ]);

  if (!interestIncome.ok) {
    return {
      ok: false,
      error: interestIncome.error,
      meta: { baseUrl: API_BASE_URL },
    };
  }

  if (!penaltyIncome.ok) {
    return {
      ok: false,
      error: penaltyIncome.error,
      meta: { baseUrl: API_BASE_URL },
    };
  }

  if (!portfolioSummary.ok) {
    return {
      ok: false,
      error: portfolioSummary.error,
      meta: { baseUrl: API_BASE_URL },
    };
  }

  if (!paymentsHistory.ok) {
    return {
      ok: false,
      error: paymentsHistory.error,
      meta: { baseUrl: API_BASE_URL },
    };
  }

  if (!closedLoans.ok) {
    return {
      ok: false,
      error: closedLoans.error,
      meta: { baseUrl: API_BASE_URL },
    };
  }

  return {
    ok: true,
    data: {
      interestIncome: interestIncome.data,
      penaltyIncome: penaltyIncome.data,
      portfolioSummary: portfolioSummary.data,
      paymentsHistory: paymentsHistory.data,
      closedLoans: closedLoans.data,
    },
    meta: { baseUrl: API_BASE_URL },
  };
}
