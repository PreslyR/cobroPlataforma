import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { jwtVerify } from 'jose';
import { AuthService } from './auth.service';

jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({})),
  jwtVerify: jest.fn(),
}));

const mockedJwtVerify = jwtVerify as unknown as jest.Mock;

describe('AuthService', () => {
  beforeEach(() => {
    mockedJwtVerify.mockReset();
  });

  it('coalesces concurrent internal user lookups for the same email', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'supabase-user-1',
        email: 'admin@example.com',
      },
    });

    const prisma = {
      user: {
        findFirst: jest.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));

          return {
            id: 'user-1',
            email: 'admin@example.com',
            role: UserRole.ADMIN,
            lenderId: 'lender-1',
            lender: {
              name: 'Prestamista',
            },
          };
        }),
      },
    };
    const service = new AuthService(
      makeConfigService() as never,
      prisma as never,
    );

    const [first, second] = await Promise.all([
      service.authenticateAccessToken('token-1'),
      service.authenticateAccessToken('token-1'),
    ]);

    expect(mockedJwtVerify).toHaveBeenCalledTimes(2);
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      id: 'user-1',
      lenderId: 'lender-1',
      supabaseUserId: 'supabase-user-1',
    });
  });

  it('rejects valid tokens without an internal admin mapping', async () => {
    mockedJwtVerify.mockResolvedValue({
      payload: {
        sub: 'supabase-user-1',
        email: 'missing@example.com',
      },
    });

    const prisma = {
      user: {
        findFirst: jest.fn(async () => null),
      },
    };
    const service = new AuthService(
      makeConfigService() as never,
      prisma as never,
    );

    await expect(service.authenticateAccessToken('token-1')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

function makeConfigService() {
  return {
    get: jest.fn((key: string) => {
      if (key === 'SUPABASE_URL') {
        return 'https://example.supabase.co';
      }

      if (key === 'SUPABASE_JWT_AUDIENCE') {
        return 'authenticated';
      }

      return undefined;
    }),
  };
}
