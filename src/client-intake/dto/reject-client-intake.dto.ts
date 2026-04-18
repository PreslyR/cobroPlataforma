import { IsOptional, IsString } from 'class-validator';

export class RejectClientIntakeDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
