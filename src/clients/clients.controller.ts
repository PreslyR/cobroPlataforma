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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Body() createClientDto: CreateClientDto,
  ) {
    return this.clientsService.create({
      ...createClientDto,
      lenderId: authUser.lenderId,
    });
  }

  @Get()
  findAll(@CurrentAuthUser() authUser: AuthenticatedAppUser) {
    return this.clientsService.findAll(authUser.lenderId);
  }

  @Get('portfolio')
  getPortfolio(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Query('asOf') asOf?: string,
    @Query('search') search?: string,
  ) {
    return this.clientsService.getPortfolio({
      lenderId: authUser.lenderId,
      asOf,
      search,
    });
  }

  @Get(':id/debt')
  getClientDebt(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.clientsService.getClientDebt(id, asOf, authUser.lenderId);
  }

  @Get(':id')
  findOne(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
  ) {
    return this.clientsService.findOne(id, authUser.lenderId);
  }

  @Patch(':id')
  update(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, updateClientDto, authUser.lenderId);
  }

  @Delete(':id')
  remove(
    @CurrentAuthUser() authUser: AuthenticatedAppUser,
    @Param('id') id: string,
  ) {
    return this.clientsService.remove(id, authUser.lenderId);
  }
}
