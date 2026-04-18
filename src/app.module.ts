import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClientIntakeModule } from './client-intake/client-intake.module';
import { PrismaModule } from './prisma/prisma.module';
import { LenderModule } from './lender/lender.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { LoansModule } from './loans/loans.module';
import { PaymentsModule } from './payments/payments.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    ClientIntakeModule,
    PrismaModule,
    LenderModule,
    UsersModule,
    ClientsModule,
    LoansModule,
    PaymentsModule,
    ReportsModule,
    DashboardModule,
  ],
})
export class AppModule {}
