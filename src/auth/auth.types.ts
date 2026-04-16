import { UserRole } from '@prisma/client';
import { Request } from 'express';

export type AuthenticatedAppUser = {
  id: string;
  email: string;
  role: UserRole;
  lenderId: string;
  lenderName: string;
  supabaseUserId: string;
};

export type AuthenticatedRequest = Request & {
  authUser: AuthenticatedAppUser;
};

