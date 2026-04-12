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
    const method = request?.method ?? 'UNKNOWN';
    const url = request?.originalUrl ?? request?.url ?? 'unknown-url';
    const startedAt = performance.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${method} ${url} took ${(performance.now() - startedAt).toFixed(1)}ms`,
          );
        },
        error: () => {
          this.logger.error(
            `${method} ${url} failed after ${(performance.now() - startedAt).toFixed(1)}ms`,
          );
        },
      }),
    );
  }
}
