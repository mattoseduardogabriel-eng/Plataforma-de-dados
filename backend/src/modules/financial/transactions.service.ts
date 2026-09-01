import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, createdById: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        organizationId,
        createdById,
        type: dto.type,
        description: dto.description,
        amount: dto.amount,
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? 'PENDENTE',
        categoryId: dto.categoryId,
        customerId: dto.customerId,
      },
      include: { category: true, customer: { select: { id: true, name: true } } },
    });
  }

  findAll(
    organizationId: string,
    filters: { type?: string; status?: string; from?: string; to?: string; customerId?: string },
  ) {
    const where: Prisma.TransactionWhereInput = {
      organizationId,
      type: filters.type as any,
      status: filters.status as any,
      customerId: filters.customerId,
      dueDate: {
        gte: filters.from ? new Date(filters.from) : undefined,
        lte: filters.to ? new Date(filters.to) : undefined,
      },
    };
    return this.prisma.transaction.findMany({
      where,
      include: { category: true, customer: { select: { id: true, name: true } } },
      orderBy: { dueDate: 'desc' },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateTransactionDto) {
    const existing = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException('Lançamento não encontrado.');
    }
    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        paidAt: dto.status === 'PAGO' ? new Date() : undefined,
      },
      include: { category: true, customer: { select: { id: true, name: true } } },
    });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.prisma.transaction.findFirst({ where: { id, organizationId } });
    if (!existing) {
      throw new NotFoundException('Lançamento não encontrado.');
    }
    await this.prisma.transaction.update({ where: { id }, data: { status: 'CANCELADO' } });
    return { success: true };
  }
}
