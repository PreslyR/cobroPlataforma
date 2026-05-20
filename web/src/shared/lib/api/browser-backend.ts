"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
const WEB_CLIENT_PERF_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_WEB_PERF_LOGS === "true";

function createTraceId() {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function getBackendPathMeta(path: string) {
  const url = new URL(path, "http://backend.local");
  const queryKeys = Array.from(url.searchParams.keys()).sort();

  return {
    backendPath: url.pathname,
    queryKeys: queryKeys.length > 0 ? queryKeys.join(",") : null,
  };
}

function logBrowserBackendPerf(
  event: string,
  meta: Record<string, boolean | number | string | null | undefined>,
) {
  if (!WEB_CLIENT_PERF_ENABLED) {
    return;
  }

  console.log(
    JSON.stringify({
      level: "info",
      scope: "web-client",
      event,
      ...Object.fromEntries(
        Object.entries(meta).filter(([, value]) => value !== undefined),
      ),
    }),
  );
}

export async function fetchBackendFromBrowser(path: string, init: RequestInit = {}) {
  const supabase = getSupabaseBrowserClient();
  const startedAt = performance.now();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("No active session was found.");
  }

  const headers = new Headers(init.headers);
  const traceId = headers.get("X-Trace-Id") ?? createTraceId();
  const method = init.method ?? "GET";
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("X-Trace-Id", traceId);
  headers.set("X-Frontend-Source", "browser");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  logBrowserBackendPerf("backend.fetch", {
    ...getBackendPathMeta(path),
    method,
    status: response.status,
    ok: response.ok,
    traceId,
    ms: Number((performance.now() - startedAt).toFixed(1)),
  });

  return response;
}

export function getBrowserBackendBaseUrl() {
  return API_BASE_URL;
}
