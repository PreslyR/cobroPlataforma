import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { InterestCalculationService } from './services/interest-calculation.service';
import { PenaltyCalculationService } from './services/penalty-calculation.service';
import { PaymentDistributionService } from './services/payment-distribution.service';
import { AccrualProjectionService } from './services/accrual-projection.service';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    InterestCalculationService,
    PenaltyCalculationService,
    PaymentDistributionService,
    AccrualProjectionService,
  ],
  exports: [
    PaymentsService,
    InterestCalculationService,
    PenaltyCalculationService,
    PaymentDistributionService,
    AccrualProjectionService,
  ],
})
export class PaymentsModule {}
