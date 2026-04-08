import { PartialType } from '@nestjs/mapped-types';
import { CreateLenderDto } from './create-lender.dto';

export class UpdateLenderDto extends PartialType(CreateLenderDto) {}
