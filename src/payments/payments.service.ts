import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EarlySettlementInterestMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentDistributionService } from './services/payment-distribution.service';

type SimulatePaymentOptions = {
  paymentDate?: string;
  isEarlySettlement?: boolean;
  earlySettlementInterestModeOverride?: EarlySettlementInterestMode;
};

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private paymentDistribution: PaymentDistributionService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto, lenderId?: string) {
    await this.assertLoanAndClientAccess(
      createPaymentDto.loanId,
      createPaymentDto.clientId,
      lenderId,
    );

    const paymentDate = this.parseOperationalPaymentDate(
      createPaymentDto.paymentDate,
    );

    return this.paymentDistribution.processPayment(
      createPaymentDto.loanId,
      createPaymentDto.clientId,
      createPaymentDto.totalAmount,
      paymentDate,
      {
        isEarlySettlement: createPaymentDto.isEarlySettlement,
        earlySettlementInterestModeOverride:
          createPaymentDto.earlySettlementInterestModeOverride,
      },
    );
  }

  async findAll(loanId?: string, clientId?: string, lenderId?: string) {
    return this.prisma.payment.findMany({
      where: {
        ...(loanId && { loanId }),
        ...(clientId && { clientId }),
        ...(lenderId && {
          loan: {
            lenderId,
          },
        }),
      },
      include: {
        loan: {
          select: {
            id: true,
            type: true,
            principalAmount: true,
            currentPrincipal: true,
            status: true,
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
            documentNumber: true,
          },
        },
      },
      orderBy: {
        paymentDate: 'desc',
      },
    });
  }

  async findOne(id: string, lenderId?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        ...(lenderId && {
          loan: {
            lenderId,
          },
        }),
      },
      include: {
        loan: {
          select: {
            id: true,
            type: true,
            principalAmount: true,
            currentPrincipal: true,
            status: true,
            client: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            fullName: true,
            documentNumber: true,
            phone: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async simulatePayment(
    loanId: string,
    amount: number,
    options: SimulatePaymentOptions = {},
    lenderId?: string,
  ) {
    await this.assertLoanAccess(loanId, lenderId);

    const paymentDate = this.parseOperationalPaymentDate(options.paymentDate);

    return this.paymentDistribution.simulatePayment(loanId, amount, paymentDate, {
      isEarlySettlement: options.isEarlySettlement,
      earlySettlementInterestModeOverride:
        options.earlySettlementInterestModeOverride,
    });
  }

  private parseOperationalPaymentDate(value?: string): Date {
    const parsedDate = value ? new Date(value) : new Date();

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`Invalid paymentDate value: ${value}`);
    }

    const normalizedDate = this.toUtcDateOnly(parsedDate);
    const today = this.toUtcDateOnly(new Date());

    if (normalizedDate > today) {
      throw new BadRequestException('Future payment dates are not allowed.');
    }

    return normalizedDate;
  }

  private toUtcDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private async assertLoanAccess(loanId: string, lenderId?: string) {
    if (!lenderId) {
      return;
    }

    const loan = await this.prisma.loan.findFirst({
      where: {
        id: loanId,
        lenderId,
      },
      select: { id: true },
    });

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${loanId} not found`);
    }
  }

  private async assertLoanAndClientAccess(
    loanId: string,
    clientId: string,
    lenderId?: string,
  ) {
    if (!lenderId) {
      return;
    }

    const [loan, client] = await Promise.all([
      this.prisma.loan.findFirst({
        where: {
          id: loanId,
          lenderId,
        },
        select: { id: true },
      }),
      this.prisma.client.findFirst({
        where: {
          id: clientId,
          lenderId,
        },
        select: { id: true },
      }),
    ]);

    if (!loan) {
      throw new NotFoundException(`Loan with ID ${loanId} not found`);
    }

    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }
  }
}
