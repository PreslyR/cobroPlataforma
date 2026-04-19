import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import {
  EarlySettlementInterestMode,
  LoanType,
  PaymentFrequency,
  LoanStatus,
} from '@prisma/client';

export class CreateLoanDto {
  @IsString()
  @IsOptional()
  lenderId?: string;

  @IsString()
  clientId: string;

  @IsEnum(LoanType)
  type: LoanType;

  @IsNumber()
  @Min(0)
  principalAmount: number;

  // Solo requerido para DAILY_INTEREST y MONTHLY_INTEREST
  @ValidateIf((o) => o.type !== LoanType.FIXED_INSTALLMENTS)
  @IsNumber()
  @Min(0)
  @Max(1, {
    message:
      'monthlyInterestRate must be sent as a decimal fraction between 0 and 1.',
  })
  monthlyInterestRate?: number;

  // Solo requerido para FIXED_INSTALLMENTS
  @ValidateIf((o) => o.type === LoanType.FIXED_INSTALLMENTS)
  @IsNumber()
  @Min(0)
  installmentAmount?: number;

  @ValidateIf((o) => o.type === LoanType.FIXED_INSTALLMENTS)
  @IsNumber()
  @Min(1)
  totalInstallments?: number;

  @IsEnum(PaymentFrequency)
  paymentFrequency: PaymentFrequency;

  @IsEnum(EarlySettlementInterestMode)
  @IsOptional()
  earlySettlementInterestMode?: EarlySettlementInterestMode;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsOptional()
  expectedEndDate?: string;

  @IsEnum(LoanStatus)
  @IsOptional()
  status?: LoanStatus;
}
