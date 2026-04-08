import { PartialType } from '@nestjs/mapped-types';
import { CreateLoanDto } from './create-loan.dto';
import { IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { LoanStatus } from '@prisma/client';

export class UpdateLoanDto extends PartialType(CreateLoanDto) {
  @IsNumber()
  @IsOptional()
  @Min(0)
  currentPrincipal?: number;

  @IsEnum(LoanStatus)
  @IsOptional()
  status?: LoanStatus;
}
