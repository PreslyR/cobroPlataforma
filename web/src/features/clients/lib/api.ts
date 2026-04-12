import {
  ClientDebtResponse,
  ClientsPortfolioResponse,
} from "@/features/clients/types";

type Result<T> =
  | { ok: true; data: T; meta: { baseUrl: string } }
  | { ok: false; error: string; meta: { baseUrl: string } };

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api";
const READ_REVALIDATE_SECONDS = 5;

async function fetchJson<T>(path: string): Promise<Result<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      next: { revalidate: READ_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `El backend respondio con ${response.status}.`,
        meta: { baseUrl: API_BASE_URL },
      };
    }

    return {
      ok: true,
      data: (await response.json()) as T,
      meta: { baseUrl: API_BASE_URL },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "No se pudo conectar con el backend.",
      meta: { baseUrl: API_BASE_URL },
    };
  }
}

export async function getClientsPortfolio({
  lenderId,
  asOf,
  search,
}: {
  lenderId: string;
  asOf?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams({ lenderId });

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
