import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { AuthenticatedAppUser } from '../auth/auth.types';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Body() createUserDto: CreateUserDto,
  ) {
    return this.usersService.create({
      ...createUserDto,
      lenderId: authUser.lenderId,
    });
  }

  @Get()
  findAll(@CurrentAuthUser() authUser: AuthenticatedAppUser) {
    return this.usersService.findAll(authUser.lenderId);
  }

  @Get(':id')
  findOne(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
  ) {
    return this.usersService.findOne(id, authUser.lenderId);
  }

  @Patch(':id')
  update(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto, authUser.lenderId);
  }

  @Delete(':id')
  remove(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
  ) {
    return this.usersService.remove(id, authUser.lenderId);
  }
}
