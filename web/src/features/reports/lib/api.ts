import {
  ReportOverviewResponse,
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

async function fetchJson<T>(path: string): Promise<FetchResult<T>> {
  try {
    const response = await fetchBackendFromServer(path, {
      cache: "no-store",
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
  const searchParams = new URLSearchParams({
    from,
    to,
    limit: "20",
  });

  const overview = await fetchJson<ReportOverviewResponse>(
    `/reports/overview?${searchParams.toString()}`,
  );

  if (!overview.ok) {
    return {
      ok: false,
      error: overview.error,
      meta: { baseUrl },
    };
  }

  return {
    ok: true,
    data: overview.data,
    meta: { baseUrl },
  };
}
