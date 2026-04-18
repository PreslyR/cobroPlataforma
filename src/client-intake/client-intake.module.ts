import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ClientIntakeController } from './client-intake.controller';
import { ClientIntakeService } from './client-intake.service';

@Module({
  imports: [ClientsModule],
  controllers: [ClientIntakeController],
  providers: [ClientIntakeService],
  exports: [ClientIntakeService],
})
export class ClientIntakeModule {}
