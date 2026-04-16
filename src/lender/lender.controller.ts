import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { AuthenticatedAppUser } from '../auth/auth.types';
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
  findAll(@CurrentAuthUser() authUser: AuthenticatedAppUser) {
    return this.lenderService.findAll(authUser.lenderId);
  }

  @Get(':id')
  findOne(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
  ) {
    return this.lenderService.findOne(id, authUser.lenderId);
  }

  @Patch(':id')
  update(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Body() updateLenderDto: UpdateLenderDto,
  ) {
    return this.lenderService.update(id, updateLenderDto, authUser.lenderId);
  }

  @Delete(':id')
  remove(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
  ) {
    return this.lenderService.remove(id, authUser.lenderId);
  }
}
