import { DashboardTodayResponse } from "@/features/dashboard/types";

type DashboardParams = {
  date?: string;
  lenderId: string;
};

type DashboardResult =
  | {
      ok: true;
      data: DashboardTodayResponse;
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

export async function getDashboardToday({
  date,
  lenderId,
}: DashboardParams): Promise<DashboardResult> {
  const searchParams = new URLSearchParams({ lenderId });
  if (date) {
    searchParams.set("date", date);
  }

  const url = `${API_BASE_URL}/dashboard/today?${searchParams.toString()}`;

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

    const data = (await response.json()) as DashboardTodayResponse;

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
