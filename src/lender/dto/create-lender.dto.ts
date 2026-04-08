import { IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateLenderDto {
  @IsString()
  name: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
