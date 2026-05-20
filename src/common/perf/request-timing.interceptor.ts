import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { performance } from 'node:perf_hooks';
import { isPerfLoggingEnabled } from './perf-logger';

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (!isPerfLoggingEnabled()) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.originalUrl ?? request?.url ?? 'unknown-url';
    const path = String(url).split('?')[0];
    const traceId = this.getHeaderValue(request, 'x-trace-id');
    const frontendSource = this.getHeaderValue(request, 'x-frontend-source');
    const startedAt = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            JSON.stringify({
              level: 'info',
              scope: 'api',
              event: 'request_done',
              method,
              path,
              statusCode: response?.statusCode ?? null,
              traceId,
              frontendSource,
              ms: Number((performance.now() - startedAt).toFixed(1)),
            }),
          );
        },
        error: (error) => {
          this.logger.error(
            JSON.stringify({
              level: 'error',
              scope: 'api',
              event: 'request_failed',
              method,
              path,
              statusCode: response?.statusCode ?? null,
              traceId,
              frontendSource,
              error: error instanceof Error ? error.name : String(error),
              ms: Number((performance.now() - startedAt).toFixed(1)),
            }),
          );
        },
      }),
    );
  }

  private getHeaderValue(request: any, name: string) {
    const value = request?.headers?.[name];

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return typeof value === 'string' ? value : null;
  }
}
