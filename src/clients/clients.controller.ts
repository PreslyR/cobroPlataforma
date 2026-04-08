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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  findAll(@Query('lenderId') lenderId?: string) {
    return this.clientsService.findAll(lenderId);
  }

  @Get('portfolio')
  getPortfolio(
    @Query('lenderId') lenderId?: string,
    @Query('asOf') asOf?: string,
    @Query('search') search?: string,
  ) {
    return this.clientsService.getPortfolio({ lenderId, asOf, search });
  }

  @Get(':id/debt')
  getClientDebt(
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    return this.clientsService.getClientDebt(id, asOf);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateClientDto: UpdateClientDto) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
