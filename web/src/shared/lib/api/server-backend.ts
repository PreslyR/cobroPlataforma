import "server-only";

import { randomUUID } from "node:crypto";
import { requireAuthSession } from "@/shared/lib/auth/require-auth-session";
import { measureServerPerf } from "@/shared/lib/perf/server-perf";

const API_BASE_URL =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api";

type ServerBackendFetchOptions = {
  revalidate?: number;
  init?: RequestInit;
};

function getBackendPathMeta(path: string) {
  const url = new URL(path, "http://backend.local");
  const queryKeys = Array.from(url.searchParams.keys()).sort();

  return {
    backendPath: url.pathname,
    queryKeys: queryKeys.length > 0 ? queryKeys.join(",") : null,
  };
}

export async function fetchBackendFromServer(
  path: string,
  options: ServerBackendFetchOptions = {},
) {
  const { session } = await requireAuthSession();
  const headers = new Headers(options.init?.headers);
  const traceId = headers.get("X-Trace-Id") ?? randomUUID();
  const method = options.init?.method ?? "GET";
  const pathMeta = getBackendPathMeta(path);

  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("X-Trace-Id", traceId);
  headers.set("X-Frontend-Source", "next-server");

  return measureServerPerf(
    "backend.fetch",
    async () => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options.init,
        headers,
        ...(options.revalidate !== undefined
          ? { next: { revalidate: options.revalidate } }
          : {}),
      });

      return response;
    },
    {
      ...pathMeta,
      method,
      revalidate: options.revalidate ?? null,
      traceId,
    },
  );
}

export function getBackendBaseUrl() {
  return API_BASE_URL;
}
