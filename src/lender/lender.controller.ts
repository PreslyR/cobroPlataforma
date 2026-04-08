import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { LenderService } from './lender.service';
import { CreateLenderDto } from './dto/create-lender.dto';
import { UpdateLenderDto } from './dto/update-lender.dto';

@Controller('lenders')
export class LenderController {
  constructor(private readonly lenderService: LenderService) {}

  @Post()
  create(@Body() createLenderDto: CreateLenderDto) {
    return this.lenderService.create(createLenderDto);
  }

  @Get()
  findAll() {
    return this.lenderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lenderService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLenderDto: UpdateLenderDto) {
    return this.lenderService.update(id, updateLenderDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lenderService.remove(id);
  }
}
