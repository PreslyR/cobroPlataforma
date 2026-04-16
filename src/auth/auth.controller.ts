import { Controller, Get } from '@nestjs/common';
import { CurrentAuthUser } from './current-auth-user.decorator';
import { AuthenticatedAppUser } from './auth.types';

@Controller('auth')
export class AuthController {
  @Get('me')
  getMe(@CurrentAuthUser() authUser: AuthenticatedAppUser) {
    return {
      user: {
        id: authUser.id,
        email: authUser.email,
        role: authUser.role,
        supabaseUserId: authUser.supabaseUserId,
      },
      lender: {
        id: authUser.lenderId,
        name: authUser.lenderName,
      },
    };
  }
}

