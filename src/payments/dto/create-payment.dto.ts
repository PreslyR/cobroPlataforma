import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { EarlySettlementInterestMode } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  loanId: string;

  @IsString()
  clientId: string;

  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsBoolean()
  @IsOptional()
  isEarlySettlement?: boolean;

  @IsEnum(EarlySettlementInterestMode)
  @IsOptional()
  earlySettlementInterestModeOverride?: EarlySettlementInterestMode;
}
