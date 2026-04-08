import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today')
  getToday(
    @Query('date') date?: string,
    @Query('lenderId') lenderId?: string,
  ) {
    return this.dashboardService.getToday(date, lenderId);
  }
}
