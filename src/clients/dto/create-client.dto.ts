import { IsString, IsOptional, IsBoolean, IsEmail } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsOptional()
  lenderId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  fullName: string;

  @IsString()
  documentNumber: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
