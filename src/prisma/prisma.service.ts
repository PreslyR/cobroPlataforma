import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly retryableErrorCodes = new Set(['P1001', 'P1002', 'P1017']);

  constructor() {
    super();
    this.registerQueryRetryMiddleware();
  }

  async onModuleInit() {
    const maxRetries = Number(process.env.PRISMA_CONNECT_MAX_RETRIES ?? 5);
    const baseDelayMs = Number(process.env.PRISMA_CONNECT_RETRY_DELAY_MS ?? 1000);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log(`Prisma connected on attempt ${attempt}/${maxRetries}`);
        return;
      } catch (error: any) {
        const errorCode = error?.code ?? 'UNKNOWN';
        const errorMessage = error?.message ?? 'No error message';
        const isLastAttempt = attempt === maxRetries;

        this.logger.warn(
          `Prisma connection failed (attempt ${attempt}/${maxRetries}) [${errorCode}]: ${errorMessage}`,
        );

        if (isLastAttempt) {
          throw error;
        }

        const delayMs = baseDelayMs * attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private registerQueryRetryMiddleware() {
    const maxAttempts = Number(process.env.PRISMA_QUERY_RETRY_MAX_ATTEMPTS ?? 3);
    const baseDelayMs = Number(process.env.PRISMA_QUERY_RETRY_BASE_DELAY_MS ?? 250);
    const maxDelayMs = Number(process.env.PRISMA_QUERY_RETRY_MAX_DELAY_MS ?? 2000);
    const jitterMs = Number(process.env.PRISMA_QUERY_RETRY_JITTER_MS ?? 100);
    const retryOnWrite = String(process.env.PRISMA_QUERY_RETRY_ON_WRITE ?? 'false').toLowerCase() === 'true';

    this.$use(async (params, next) => {
      const canRetryThisAction = this.canRetryAction(params, retryOnWrite);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await next(params);
        } catch (error: any) {
          const isRetryable = canRetryThisAction && this.isRetryableConnectionError(error);
          const isLastAttempt = attempt === maxAttempts;

          if (!isRetryable || isLastAttempt) {
            throw error;
          }

          const backoffDelayMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
          const randomizedDelayMs = backoffDelayMs + Math.floor(Math.random() * Math.max(jitterMs, 0));

          this.logger.warn(
            `Retrying Prisma query (${params.model ?? 'raw'}.${params.action}) after connection error ` +
              `(attempt ${attempt + 1}/${maxAttempts}, wait ${randomizedDelayMs}ms)`,
          );

          try {
            await this.$disconnect();
            await this.$connect();
          } catch {
            // Ignore reconnect errors here; the next query attempt will surface the final failure if still broken.
          }

          await this.sleep(randomizedDelayMs);
        }
      }

      throw new Error('Unexpected Prisma retry flow.');
    });
  }

  private canRetryAction(params: Prisma.MiddlewareParams, retryOnWrite: boolean): boolean {
    if (params.runInTransaction) {
      return false;
    }

    if (retryOnWrite) {
      return true;
    }

    const readActions = new Set([
      'findUnique',
      'findUniqueOrThrow',
      'findFirst',
      'findFirstOrThrow',
      'findMany',
      'count',
      'aggregate',
      'groupBy',
      'queryRaw',
      'queryRawUnsafe',
    ]);

    return readActions.has(params.action);
  }

  private isRetryableConnectionError(error: any): boolean {
    const code = error?.code;
    if (code && this.retryableErrorCodes.has(code)) {
      return true;
    }

    const message = String(error?.message ?? '').toLowerCase();
    return (
      message.includes("can't reach database server") ||
      message.includes('connection') ||
      message.includes('socket')
    );
  }

  private async sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
