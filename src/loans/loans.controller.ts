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
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { AuthenticatedAppUser } from '../auth/auth.types';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';

@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  create(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Body() createLoanDto: CreateLoanDto,
  ) {
    return this.loansService.create({
      ...createLoanDto,
      lenderId: authUser.lenderId,
    });
  }

  @Get()
  findAll(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('clientId') clientId?: string,
  ) {
    return this.loansService.findAll(authUser.lenderId, clientId);
  }

  @Get('due-today')
  getDueToday(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('date') date?: string,
  ) {
    return this.loansService.getDueToday(date, authUser.lenderId);
  }

  @Get('overdue')
  getOverdue(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('date') date?: string,
  ) {
    return this.loansService.getOverdue(date, authUser.lenderId);
  }

  @Get('portfolio')
  getPortfolio(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.loansService.getPortfolio({
      date,
      lenderId: authUser.lenderId,
      status,
      type,
      search,
    });
  }

  @Get(':id/debt-breakdown')
  getDebtBreakdown(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.loansService.getDebtBreakdown(id, asOf, authUser.lenderId);
  }

  @Get(':id/payoff-preview')
  getPayoffPreview(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Query('paymentDate') paymentDate?: string,
    @Query('mode') mode?: string,
  ) {
    return this.loansService.getPayoffPreview(
      id,
      paymentDate,
      mode,
      authUser.lenderId,
    );
  }

  @Get(':id')
  findOne(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.loansService.findOne(id, asOf, authUser.lenderId);
  }

  @Get(':id/summary')
  getLoanSummary(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.loansService.getLoanSummary(id, asOf, authUser.lenderId);
  }

  @Patch(':id')
  update(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Body() updateLoanDto: UpdateLoanDto,
  ) {
    return this.loansService.update(id, updateLoanDto, authUser.lenderId);
  }

  @Delete(':id')
  remove(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
  ) {
    return this.loansService.remove(id, authUser.lenderId);
  }
}
