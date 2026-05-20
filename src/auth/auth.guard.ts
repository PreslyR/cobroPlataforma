import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { performance } from 'node:perf_hooks';
import { isPerfLoggingEnabled } from '../common/perf/perf-logger';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    const startedAt = performance.now();

    try {
      request.authUser = await this.authService.authenticateAccessToken(token);

      if (isPerfLoggingEnabled()) {
        this.logger.log(
          JSON.stringify({
            level: 'info',
            scope: 'api',
            event: 'auth_guard_done',
            method: request.method ?? null,
            path: String(request.originalUrl ?? request.url ?? '').split('?')[0],
            traceId: this.getHeaderValue(request, 'x-trace-id'),
            frontendSource: this.getHeaderValue(request, 'x-frontend-source'),
            ms: Number((performance.now() - startedAt).toFixed(1)),
          }),
        );
      }
    } catch (error) {
      if (isPerfLoggingEnabled()) {
        this.logger.error(
          JSON.stringify({
            level: 'error',
            scope: 'api',
            event: 'auth_guard_failed',
            method: request.method ?? null,
            path: String(request.originalUrl ?? request.url ?? '').split('?')[0],
            traceId: this.getHeaderValue(request, 'x-trace-id'),
            frontendSource: this.getHeaderValue(request, 'x-frontend-source'),
            error: error instanceof Error ? error.name : String(error),
            ms: Number((performance.now() - startedAt).toFixed(1)),
          }),
        );
      }

      throw error;
    }

    return true;
  }

  private getHeaderValue(request: AuthenticatedRequest, name: string) {
    const value = request.headers[name];

    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    return typeof value === 'string' ? value : null;
  }
}
