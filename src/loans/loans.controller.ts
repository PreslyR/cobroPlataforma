import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  create(@Body() createLoanDto: CreateLoanDto) {
    return this.loansService.create(createLoanDto);
  }

  @Get()
  findAll(
    @Query('lenderId') lenderId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.loansService.findAll(lenderId, clientId);
  }

  @Get('due-today')
  getDueToday(
    @Query('date') date?: string,
    @Query('lenderId') lenderId?: string,
  ) {
    return this.loansService.getDueToday(date, lenderId);
  }

  @Get('overdue')
  getOverdue(
    @Query('date') date?: string,
    @Query('lenderId') lenderId?: string,
  ) {
    return this.loansService.getOverdue(date, lenderId);
  }

  @Get('portfolio')
  getPortfolio(
    @Query('date') date?: string,
    @Query('lenderId') lenderId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.loansService.getPortfolio({
      date,
      lenderId,
      status,
      type,
      search,
    });
  }

  @Get(':id/debt-breakdown')
  getDebtBreakdown(
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.loansService.getDebtBreakdown(id, asOf);
  }

  @Get(':id/payoff-preview')
  getPayoffPreview(
    @Param('id') id: string,
    @Query('paymentDate') paymentDate?: string,
    @Query('mode') mode?: string,
  ) {
    return this.loansService.getPayoffPreview(id, paymentDate, mode);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.loansService.findOne(id, asOf);
  }

  @Get(':id/summary')
  getLoanSummary(
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.loansService.getLoanSummary(id, asOf);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLoanDto: UpdateLoanDto) {
    return this.loansService.update(id, updateLoanDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.loansService.remove(id);
  }
}
