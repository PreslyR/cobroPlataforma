import { DashboardTodayResponse } from "@/features/dashboard/types";
import {
  fetchBackendFromServer,
  getBackendBaseUrl,
} from "@/shared/lib/api/server-backend";

type DashboardParams = {
  date?: string;
};

export type DashboardResult =
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

export async function getDashboardToday({
  date,
}: DashboardParams): Promise<DashboardResult> {
  const searchParams = new URLSearchParams();
  if (date) {
    searchParams.set("date", date);
  }

  const path = `/dashboard/today${
    searchParams.toString() ? `?${searchParams.toString()}` : ""
  }`;
  const baseUrl = getBackendBaseUrl();

  try {
    const response = await fetchBackendFromServer(path, {
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `El backend respondio con ${response.status}.`,
        meta: { baseUrl },
      };
    }

    const data = (await response.json()) as DashboardTodayResponse;

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
