import "server-only";

import { performance } from "node:perf_hooks";

type PerfMeta = Record<string, boolean | number | string | null | undefined>;

function isWebPerfLoggingEnabled() {
  return (
    String(
      process.env.ENABLE_WEB_PERF_LOGS ??
        process.env.NEXT_PUBLIC_ENABLE_WEB_PERF_LOGS ??
        "false",
    ).toLowerCase() === "true"
  );
}

function cleanMeta(meta: PerfMeta = {}) {
  return Object.fromEntries(
    Object.entries(meta).filter(([, value]) => value !== undefined),
  );
}

function writePerfLog(
  level: "info" | "error",
  event: string,
  meta: PerfMeta = {},
) {
  if (!isWebPerfLoggingEnabled()) {
    return;
  }

  const payload = JSON.stringify({
    level,
    scope: "web",
    event,
    ...cleanMeta(meta),
  });

  if (level === "error") {
    console.error(payload);
    return;
  }

  console.log(payload);
}

export async function measureServerPerf<T>(
  event: string,
  work: () => Promise<T>,
  meta: PerfMeta = {},
): Promise<T> {
  if (!isWebPerfLoggingEnabled()) {
    return work();
  }

  const startedAt = performance.now();

  try {
    const result = await work();
    writePerfLog("info", event, {
      ...meta,
      ms: Number((performance.now() - startedAt).toFixed(1)),
    });
    return result;
  } catch (error) {
    writePerfLog("error", event, {
      ...meta,
      ms: Number((performance.now() - startedAt).toFixed(1)),
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
