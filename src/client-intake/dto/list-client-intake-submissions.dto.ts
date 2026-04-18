import { ClientIntakeStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListClientIntakeSubmissionsDto {
  @IsEnum(ClientIntakeStatus)
  @IsOptional()
  status?: ClientIntakeStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
