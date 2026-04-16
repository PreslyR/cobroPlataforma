import {
  ReportClosedLoansResponse,
  ReportInterestIncomeResponse,
  ReportPaymentsHistoryResponse,
  ReportPenaltyIncomeResponse,
  ReportPortfolioSummaryResponse,
  ReportsPageData,
} from "@/features/reports/types";
import {
  fetchBackendFromServer,
  getBackendBaseUrl,
} from "@/shared/lib/api/server-backend";

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

const READ_REVALIDATE_SECONDS = 10;

async function fetchJson<T>(path: string): Promise<FetchResult<T>> {
  try {
    const response = await fetchBackendFromServer(path, {
      revalidate: READ_REVALIDATE_SECONDS,
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
  from,
  to,
}: {
  from: string;
  to: string;
}): Promise<ReportsPageResult> {
  const baseUrl = getBackendBaseUrl();
  const rangeParams = new URLSearchParams({
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
        `/reports/portfolio-summary?asOf=${encodeURIComponent(to)}`,
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
      meta: { baseUrl },
    };
  }

  if (!penaltyIncome.ok) {
    return {
      ok: false,
      error: penaltyIncome.error,
      meta: { baseUrl },
    };
  }

  if (!portfolioSummary.ok) {
    return {
      ok: false,
      error: portfolioSummary.error,
      meta: { baseUrl },
    };
  }

  if (!paymentsHistory.ok) {
    return {
      ok: false,
      error: paymentsHistory.error,
      meta: { baseUrl },
    };
  }

  if (!closedLoans.ok) {
    return {
      ok: false,
      error: closedLoans.error,
      meta: { baseUrl },
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
    meta: { baseUrl },
  };
}
