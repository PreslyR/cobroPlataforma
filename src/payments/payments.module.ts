import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { InterestCalculationService } from './services/interest-calculation.service';
import { PenaltyCalculationService } from './services/penalty-calculation.service';
import { PaymentDistributionService } from './services/payment-distribution.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    InterestCalculationService,
    PenaltyCalculationService,
    PaymentDistributionService,
  ],
  exports: [
    PaymentsService,
    InterestCalculationService,
    PenaltyCalculationService,
    PaymentDistributionService,
  ],
})
export class PaymentsModule {}
