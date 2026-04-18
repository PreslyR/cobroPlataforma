import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { LoansService } from '../loans/loans.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { measureAsync } from '../common/perf/perf-logger';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private prisma: PrismaService,
    private loansService: LoansService,
  ) {}

  async create(createClientDto: CreateClientDto) {
    const { lenderId, userId, ...clientData } = createClientDto;

    if (!lenderId) {
      throw new BadRequestException('lenderId is required to create a client');
    }

    return this.prisma.client.create({
      data: {
        ...clientData,
        lender: { connect: { id: lenderId } },
        ...(userId ? { user: { connect: { id: userId } } } : {}),
      },
      include: {
        lender: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(lenderId?: string) {
    return this.prisma.client.findMany({
      where: lenderId ? { lenderId, isActive: true } : { isActive: true },
      orderBy: {
        fullName: 'asc',
      },
      include: {
        lender: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        _count: {
          select: {
            loans: true,
            payments: true,
          },
        },
      },
    });
  }

  async findOne(id: string, lenderId?: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        ...(lenderId && { lenderId }),
      },
      include: {
        lender: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        _count: {
          select: {
            loans: true,
            payments: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto, lenderId?: string) {
    await this.findOne(id, lenderId);

    return this.prisma.client.update({
      where: { id },
      data: updateClientDto,
      include: {
        lender: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: string, lenderId?: string) {
    await this.findOne(id, lenderId);

    // Soft delete
    return this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getPortfolio(filters: {
    lenderId?: string;
    asOf?: string;
    search?: string;
  }) {
    const asOfDate = this.parseDateOnlyOrNow(filters.asOf);
    const asOfKey = this.toDateKey(asOfDate);
    const normalizedSearch = filters.search?.trim() ?? '';

    const clients = await measureAsync(this.logger, 'clients.getPortfolio.listClients', () =>
      this.prisma.client.findMany({
        where: {
          isActive: true,
          ...(filters.lenderId && { lenderId: filters.lenderId }),
          ...(normalizedSearch && {
            fullName: {
              contains: normalizedSearch,
              mode: 'insensitive',
            },
          }),
        },
        select: {
          id: true,
          lenderId: true,
          fullName: true,
          documentNumber: true,
          email: true,
          phone: true,
          loans: {
            where: {
              status: LoanStatus.ACTIVE,
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: { fullName: 'asc' },
      }),
    );

    const items = [];

    await measureAsync(this.logger, `clients.getPortfolio.snapshots x${clients.length}`, async () => {
      for (const client of clients) {
        if (client.loans.length === 0) {
          continue;
        }

        const activeLoans = await Promise.all(
          client.loans.map((loan) => this.loansService.getDebtBreakdown(loan.id, asOfKey)),
        );

        const activeLoansCount = activeLoans.length;
        const overdueLoansCount = activeLoans.filter((loan) => loan.overdue).length;
        const totalCollectibleToday = this.normalizeMoney(
          activeLoans.reduce((sum, loan) => sum + loan.totalCollectibleToday, 0),
        );
        const outstandingBalance = this.normalizeMoney(
          activeLoans.reduce((sum, loan) => sum + loan.outstandingBalance, 0),
        );
        const penaltyPending = this.normalizeMoney(
          activeLoans.reduce((sum, loan) => sum + loan.penalty.pending, 0),
        );
        const dueTodayAmount = this.normalizeMoney(
          activeLoans.reduce((sum, loan) => sum + loan.dueTodayAmount, 0),
        );
        const overdueAmount = this.normalizeMoney(
          activeLoans.reduce((sum, loan) => sum + loan.overdueAmount, 0),
        );
        const oldestDueDate =
          activeLoans
            .map((loan) => loan.oldestDueDate)
            .filter((value): value is Date => Boolean(value))
            .sort()[0] ?? null;
        const daysLate = oldestDueDate
          ? this.diffDaysUtc(oldestDueDate, asOfDate)
          : null;
        const operationalStatus =
          overdueLoansCount > 0
            ? 'OVERDUE'
            : dueTodayAmount > 0
              ? 'DUE_TODAY'
              : 'CURRENT';

        items.push({
          clientId: client.id,
          lenderId: client.lenderId,
          fullName: client.fullName,
          documentNumber: client.documentNumber,
          email: client.email,
          phone: client.phone,
          activeLoansCount,
          overdueLoansCount,
          totalCollectibleToday,
          outstandingBalance,
          penaltyPending,
          dueTodayAmount,
          overdueAmount,
          oldestDueDate,
          daysLate,
          operationalStatus,
        });
      }
    });

    items.sort((left, right) => {
      const leftRank = this.getClientOperationalRank(left.operationalStatus);
      const rightRank = this.getClientOperationalRank(right.operationalStatus);

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      if (left.operationalStatus === 'OVERDUE' && right.operationalStatus === 'OVERDUE') {
        return (right.daysLate ?? 0) - (left.daysLate ?? 0);
      }

      return left.fullName.localeCompare(right.fullName, 'es');
    });

    return {
      asOfDate,
      lenderId: filters.lenderId ?? null,
      search: normalizedSearch,
      summary: {
        clientsWithActiveLoans: items.length,
        clientsWithOverdueLoans: items.filter((item) => item.overdueLoansCount > 0).length,
        totalCollectibleToday: this.normalizeMoney(
          items.reduce((sum, item) => sum + item.totalCollectibleToday, 0),
        ),
      },
      count: items.length,
      items,
    };
  }

  async getClientDebt(id: string, asOf?: string, lenderId?: string) {
    const asOfDate = this.parseDateOnlyOrNow(asOf);
    const asOfKey = this.toDateKey(asOfDate);

    const client = await measureAsync(this.logger, 'clients.getClientDebt.loadClient', () =>
      this.prisma.client.findFirst({
        where: {
          id,
          ...(lenderId && { lenderId }),
        },
        select: {
        id: true,
        lenderId: true,
        fullName: true,
        documentNumber: true,
        email: true,
        phone: true,
        address: true,
        notes: true,
        isActive: true,
        lender: {
          select: {
            id: true,
            name: true,
          },
        },
        loans: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            status: true,
            principalAmount: true,
            currentPrincipal: true,
            installmentAmount: true,
            totalInstallments: true,
            paymentFrequency: true,
            startDate: true,
            expectedEndDate: true,
            updatedAt: true,
            payments: {
              orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: {
                id: true,
                totalAmount: true,
                appliedToInterest: true,
                appliedToPrincipal: true,
                appliedToPenalty: true,
                paymentDate: true,
                isEarlySettlement: true,
              },
            },
          },
        },
        payments: {
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
          take: 10,
          select: {
            id: true,
            loanId: true,
            totalAmount: true,
            appliedToInterest: true,
            appliedToPrincipal: true,
            appliedToPenalty: true,
            paymentDate: true,
            createdAt: true,
            isEarlySettlement: true,
            earlySettlementInterestModeUsed: true,
            interestDaysCharged: true,
            loan: {
              select: {
                type: true,
                status: true,
              },
            },
          },
        },
        },
      }),
    );

    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    const activeLoanRecords = client.loans.filter((loan) => loan.status === LoanStatus.ACTIVE);
    const inactiveLoanRecords = client.loans.filter((loan) => loan.status !== LoanStatus.ACTIVE);
    const activeLoans = await measureAsync(
      this.logger,
      `clients.getClientDebt.activeLoanSnapshots x${activeLoanRecords.length}`,
      () =>
        Promise.all(
          activeLoanRecords.map((loan) => this.loansService.getDebtBreakdown(loan.id, asOfKey)),
        ),
    );

    const activeLoanItems = activeLoans.map((loan) => ({
      loanId: loan.loan.id,
      type: loan.loan.type,
      status: loan.loan.status,
      totalCollectibleToday: loan.totalCollectibleToday,
      outstandingBalance: loan.outstandingBalance,
      dueTodayAmount: loan.dueTodayAmount,
      overdueAmount: loan.overdueAmount,
      penaltyPending: loan.penalty.pending,
      daysLate: loan.overdue ? loan.daysLate : null,
      oldestDueDate: loan.overdue ? loan.oldestDueDate : null,
    }));

    const closedLoanItems = inactiveLoanRecords.map((loan) => {
      const lastPayment = loan.payments[0] ?? null;
      const closedAt = lastPayment?.paymentDate ?? loan.updatedAt;

      return {
        loanId: loan.id,
        type: loan.type,
        status: loan.status,
        principalAmount: loan.principalAmount,
        currentPrincipal: loan.currentPrincipal,
        startDate: loan.startDate,
        expectedEndDate: loan.expectedEndDate,
        closedAt,
        lastPaymentAmount: lastPayment?.totalAmount ?? 0,
        wasEarlySettlement: lastPayment?.isEarlySettlement ?? false,
      };
    });

    const overdueLoansCount = activeLoanItems.filter((loan) => (loan.daysLate ?? 0) > 0).length;
    const totalCollectibleToday = this.normalizeMoney(
      activeLoanItems.reduce((sum, loan) => sum + loan.totalCollectibleToday, 0),
    );
    const outstandingBalance = this.normalizeMoney(
      activeLoanItems.reduce((sum, loan) => sum + loan.outstandingBalance, 0),
    );
    const penaltyPending = this.normalizeMoney(
      activeLoanItems.reduce((sum, loan) => sum + loan.penaltyPending, 0),
    );
    const dueTodayAmount = this.normalizeMoney(
      activeLoanItems.reduce((sum, loan) => sum + loan.dueTodayAmount, 0),
    );
    const overdueAmount = this.normalizeMoney(
      activeLoanItems.reduce((sum, loan) => sum + loan.overdueAmount, 0),
    );

    return {
      client: {
        id: client.id,
        lenderId: client.lenderId,
        fullName: client.fullName,
        documentNumber: client.documentNumber,
        email: client.email,
        phone: client.phone,
        address: client.address,
        notes: client.notes,
        isActive: client.isActive,
        lender: client.lender,
      },
      asOfDate,
      summary: {
        activeLoansCount: activeLoanItems.length,
        closedLoansCount: closedLoanItems.length,
        overdueLoansCount,
        totalCollectibleToday,
        outstandingBalance,
        penaltyPending,
        dueTodayAmount,
        overdueAmount,
      },
      activeLoans: activeLoanItems,
      closedLoans: closedLoanItems,
      recentPayments: client.payments.map((payment) => ({
        id: payment.id,
        loanId: payment.loanId,
        loanType: payment.loan.type,
        loanStatus: payment.loan.status,
        totalAmount: payment.totalAmount,
        appliedToInterest: payment.appliedToInterest,
        appliedToPrincipal: payment.appliedToPrincipal,
        appliedToPenalty: payment.appliedToPenalty,
        paymentDate: payment.paymentDate,
        createdAt: payment.createdAt,
        isEarlySettlement: payment.isEarlySettlement,
        earlySettlementInterestModeUsed: payment.earlySettlementInterestModeUsed,
        interestDaysCharged: payment.interestDaysCharged,
      })),
    };
  }

  private parseDateOnlyOrNow(value?: string): Date {
    if (!value) {
      return this.toUtcDateOnly(new Date());
    }

    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return this.clampToToday(
        new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))),
      );
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException(`Invalid date value: ${value}`);
    }

    return this.clampToToday(parsedDate);
  }

  private toUtcDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private clampToToday(date: Date): Date {
    const normalizedDate = this.toUtcDateOnly(date);
    const today = this.toUtcDateOnly(new Date());

    return normalizedDate > today ? today : normalizedDate;
  }

  private toDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private diffDaysUtc(startDate: string | Date, endDate: string | Date) {
    const start = this.toUtcDateOnly(new Date(startDate)).getTime();
    const end = this.toUtcDateOnly(new Date(endDate)).getTime();
    const msPerDay = 1000 * 60 * 60 * 24;

    return Math.max(0, Math.floor((end - start) / msPerDay));
  }

  private normalizeMoney(value: number) {
    return Math.abs(value) < 0.01 ? 0 : value;
  }

  private getClientOperationalRank(status: 'OVERDUE' | 'DUE_TODAY' | 'CURRENT') {
    if (status === 'OVERDUE') {
      return 0;
    }

    if (status === 'DUE_TODAY') {
      return 1;
    }

    return 2;
  }
}


