import {
  ClientDebtResponse,
  ClientIntakeSubmission,
  ClientsPortfolioResponse,
} from "@/features/clients/types";
import {
  fetchBackendFromServer,
  getBackendBaseUrl,
} from "@/shared/lib/api/server-backend";

type Result<T> =
  | { ok: true; data: T; meta: { baseUrl: string } }
  | { ok: false; error: string; meta: { baseUrl: string } };

const READ_REVALIDATE_SECONDS = 5;

async function fetchJson<T>(path: string): Promise<Result<T>> {
  const baseUrl = getBackendBaseUrl();

  try {
    const response = await fetchBackendFromServer(path, {
      revalidate: READ_REVALIDATE_SECONDS,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `El backend respondio con ${response.status}.`,
        meta: { baseUrl },
      };
    }

    return {
      ok: true,
      data: (await response.json()) as T,
      meta: { baseUrl },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el backend.",
      meta: { baseUrl },
    };
  }
}

export async function getClientsPortfolio({
  asOf,
  search,
}: {
  asOf?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();

  if (asOf) {
    searchParams.set("asOf", asOf);
  }

  if (search?.trim()) {
    searchParams.set("search", search.trim());
  }

  return fetchJson<ClientsPortfolioResponse>(
    `/clients/portfolio?${searchParams.toString()}`,
  );
}

export async function getClientDebt({
  clientId,
  asOf,
}: {
  clientId: string;
  asOf?: string;
}) {
  const searchParams = new URLSearchParams();

  if (asOf) {
    searchParams.set("asOf", asOf);
  }

  const query = searchParams.toString();

  return fetchJson<ClientDebtResponse>(
    `/clients/${clientId}/debt${query ? `?${query}` : ""}`,
  );
}

export async function getPendingClientIntakeSubmissions(limit = 50) {
  const searchParams = new URLSearchParams({
    status: "PENDING",
    limit: String(limit),
  });

  return fetchJson<ClientIntakeSubmission[]>(
    `/client-intake/submissions?${searchParams.toString()}`,
  );
}
