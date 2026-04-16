import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Verificar si el email ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    // Crear usuario
    const { password, lenderId, ...userData } = createUserDto;

    if (!lenderId) {
      throw new BadRequestException('lenderId is required to create a user');
    }

    return this.prisma.user.create({
      data: {
        ...userData,
        passwordHash,
        lender: { connect: { id: lenderId } },
      },
      select: {
        id: true,
        email: true,
        role: true,
        lenderId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(lenderId?: string) {
    return this.prisma.user.findMany({
      where: lenderId ? { lenderId, isActive: true } : { isActive: true },
      select: {
        id: true,
        email: true,
        role: true,
        lenderId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findOne(id: string, lenderId?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        ...(lenderId && { lenderId }),
      },
      select: {
        id: true,
        email: true,
        role: true,
        lenderId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lender: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto, lenderId?: string) {
    await this.findOne(id, lenderId);

    const updateData: any = { ...updateUserDto };

    // Si se actualiza la contraseña, hashearla
    if (updateUserDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      delete updateData.password;
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        lenderId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, lenderId?: string) {
    await this.findOne(id, lenderId);

    // Soft delete
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        role: true,
        lenderId: true,
        isActive: true,
      },
    });
  }
}
