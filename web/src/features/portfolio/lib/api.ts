import { PortfolioResponse } from "@/features/portfolio/types";
import {
  fetchBackendFromServer,
  getBackendBaseUrl,
} from "@/shared/lib/api/server-backend";

type PortfolioParams = {
  date?: string;
  status?: string;
  type?: string;
  search?: string;
};

type PortfolioResult =
  | {
      ok: true;
      data: PortfolioResponse;
      meta: { baseUrl: string };
    }
  | {
      ok: false;
      error: string;
      meta: { baseUrl: string };
    };

const READ_REVALIDATE_SECONDS = 5;

export async function getPortfolio({
  date,
  status,
  type,
  search,
}: PortfolioParams): Promise<PortfolioResult> {
  const searchParams = new URLSearchParams();

  if (date) {
    searchParams.set("date", date);
  }

  if (status && status !== "ALL") {
    searchParams.set("status", status);
  }

  if (type && type !== "ALL") {
    searchParams.set("type", type);
  }

  if (search?.trim()) {
    searchParams.set("search", search.trim());
  }

  const path = `/loans/portfolio${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;
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

    const data = (await response.json()) as PortfolioResponse;

    return {
      ok: true,
      data,
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
