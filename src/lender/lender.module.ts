import { Module } from '@nestjs/common';
import { LenderService } from './lender.service';
import { LenderController } from './lender.controller';

@Module({
  controllers: [LenderController],
  providers: [LenderService],
  exports: [LenderService],
})
export class LenderModule {}
