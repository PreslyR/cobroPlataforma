import { Controller, Get, Query } from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { AuthenticatedAppUser } from '../auth/auth.types';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('interest-income')
  getInterestIncome(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getInterestIncome(from, to, authUser.lenderId);
  }

  @Get('penalty-income')
  getPenaltyIncome(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getPenaltyIncome(from, to, authUser.lenderId);
  }

  @Get('portfolio-summary')
  getPortfolioSummary(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('asOf') asOf?: string,
  ) {
    return this.reportsService.getPortfolioSummary(asOf, authUser.lenderId);
  }

  @Get('payments-history')
  getPaymentsHistory(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getPaymentsHistory(
      from,
      to,
      authUser.lenderId,
      this.parseLimit(limit),
    );
  }

  @Get('closed-loans')
  getClosedLoans(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getClosedLoans(
      from,
      to,
      authUser.lenderId,
      this.parseLimit(limit),
    );
  }

  private parseLimit(value?: string): number {
    if (!value) {
      return 20;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 20;
    }

    return Math.min(parsed, 100);
  }
}
