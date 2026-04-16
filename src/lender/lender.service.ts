import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLenderDto } from './dto/create-lender.dto';
import { UpdateLenderDto } from './dto/update-lender.dto';

@Injectable()
export class LenderService {
  constructor(private prisma: PrismaService) {}

  async create(createLenderDto: CreateLenderDto) {
    return this.prisma.lender.create({
      data: createLenderDto,
    });
  }

  async findAll(lenderId?: string) {
    return this.prisma.lender.findMany({
      where: {
        isActive: true,
        ...(lenderId && { id: lenderId }),
      },
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            loans: true,
          },
        },
      },
    });
  }

  async findOne(id: string, lenderId?: string) {
    if (lenderId && id !== lenderId) {
      throw new NotFoundException(`Lender with ID ${id} not found`);
    }

    const lender = await this.prisma.lender.findFirst({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            users: true,
            clients: true,
            loans: true,
          },
        },
      },
    });

    if (!lender) {
      throw new NotFoundException(`Lender with ID ${id} not found`);
    }

    return lender;
  }

  async update(id: string, updateLenderDto: UpdateLenderDto, lenderId?: string) {
    await this.findOne(id, lenderId);

    return this.prisma.lender.update({
      where: { id },
      data: updateLenderDto,
    });
  }

  async remove(id: string, lenderId?: string) {
    await this.findOne(id, lenderId);

    return this.prisma.lender.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
