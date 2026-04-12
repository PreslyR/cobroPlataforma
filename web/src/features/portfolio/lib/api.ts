import { PortfolioResponse } from "@/features/portfolio/types";

type PortfolioParams = {
  lenderId: string;
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

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api";
const READ_REVALIDATE_SECONDS = 5;

export async function getPortfolio({
  lenderId,
  date,
  status,
  type,
  search,
}: PortfolioParams): Promise<PortfolioResult> {
  const searchParams = new URLSearchParams({ lenderId });

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

  const url = `${API_BASE_URL}/loans/portfolio?${searchParams.toString()}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: READ_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `El backend respondió con ${response.status}.`,
        meta: { baseUrl: API_BASE_URL },
      };
    }

    const data = (await response.json()) as PortfolioResponse;

    return {
      ok: true,
      data,
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
