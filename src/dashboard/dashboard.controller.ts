import { Controller, Get, Query } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { AuthenticatedAppUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today')
  getToday(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('date') date?: string,
  ) {
    return this.dashboardService.getToday(date, authUser.lenderId);
  }
}
