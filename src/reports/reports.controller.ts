import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('interest-income')
  getInterestIncome(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('lenderId') lenderId?: string,
  ) {
    return this.reportsService.getInterestIncome(from, to, lenderId);
  }

  @Get('penalty-income')
  getPenaltyIncome(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('lenderId') lenderId?: string,
  ) {
    return this.reportsService.getPenaltyIncome(from, to, lenderId);
  }

  @Get('portfolio-summary')
  getPortfolioSummary(
    @Query('asOf') asOf?: string,
    @Query('lenderId') lenderId?: string,
  ) {
    return this.reportsService.getPortfolioSummary(asOf, lenderId);
  }

  @Get('payments-history')
  getPaymentsHistory(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('lenderId') lenderId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getPaymentsHistory(
      from,
      to,
      lenderId,
      this.parseLimit(limit),
    );
  }

  @Get('closed-loans')
  getClosedLoans(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('lenderId') lenderId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getClosedLoans(
      from,
      to,
      lenderId,
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
