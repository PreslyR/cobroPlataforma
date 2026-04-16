import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedAppUser } from './auth.types';

type SupabaseJwtPayload = JWTPayload & {
  email?: string;
  role?: string;
};

@Injectable()
export class AuthService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required to validate auth tokens.');
    }

    this.issuer = `${supabaseUrl}/auth/v1`;
    this.audience =
      this.configService.get<string>('SUPABASE_JWT_AUDIENCE') ??
      'authenticated';
    this.jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
    );
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedAppUser> {
    let payload: SupabaseJwtPayload;

    try {
      const verified = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      payload = verified.payload as SupabaseJwtPayload;
    } catch {
      throw new UnauthorizedException('Invalid or expired auth token.');
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Auth token is missing the subject.');
    }

    if (!payload.email || typeof payload.email !== 'string') {
      throw new UnauthorizedException('Auth token is missing the email claim.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: payload.email,
        isActive: true,
        role: UserRole.ADMIN,
        lender: {
          isActive: true,
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        lenderId: true,
        lender: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'There is no active internal admin user linked to this auth account.',
      );
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      lenderId: user.lenderId,
      lenderName: user.lender.name,
      supabaseUserId: payload.sub,
    };
  }
}

