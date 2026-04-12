import { Logger } from '@nestjs/common';
import { performance } from 'node:perf_hooks';

const PERF_ENABLED =
  String(process.env.ENABLE_PERF_LOGS ?? 'false').toLowerCase() === 'true';

export async function measureAsync<T>(
  logger: Logger,
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  if (!PERF_ENABLED) {
    return work();
  }

  const startedAt = performance.now();

  try {
    const result = await work();
    logger.log(`${label} took ${formatDuration(performance.now() - startedAt)}`);
    return result;
  } catch (error) {
    logger.error(
      `${label} failed after ${formatDuration(performance.now() - startedAt)}`,
    );
    throw error;
  }
}

export function isPerfLoggingEnabled(): boolean {
  return PERF_ENABLED;
}

function formatDuration(durationMs: number): string {
  return `${durationMs.toFixed(1)}ms`;
}
