import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { EarlySettlementInterestMode } from '@prisma/client';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  create(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.create(createPaymentDto);
  }

  @Get()
  findAll(
    @Query('loanId') loanId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.paymentsService.findAll(loanId, clientId);
  }

  @Get('simulate/:loanId')
  simulatePayment(
    @Param('loanId') loanId: string,
    @Query('amount') amount: string,
    @Query('paymentDate') paymentDate?: string,
    @Query('isEarlySettlement') isEarlySettlement?: string,
    @Query('mode') mode?: string,
  ) {
    return this.paymentsService.simulatePayment(loanId, parseFloat(amount), {
      paymentDate,
      isEarlySettlement: this.parseBooleanQuery(isEarlySettlement),
      earlySettlementInterestModeOverride: this.parseEarlySettlementMode(mode),
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  private parseBooleanQuery(value?: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    throw new BadRequestException(`Invalid boolean value: ${value}`);
  }

  private parseEarlySettlementMode(
    value?: string,
  ): EarlySettlementInterestMode | undefined {
    if (!value) {
      return undefined;
    }

    if (value === EarlySettlementInterestMode.FULL_MONTH) {
      return EarlySettlementInterestMode.FULL_MONTH;
    }

    if (value === EarlySettlementInterestMode.PRORATED_BY_DAYS) {
      return EarlySettlementInterestMode.PRORATED_BY_DAYS;
    }

    throw new BadRequestException(`Invalid early settlement mode: ${value}`);
  }
}
