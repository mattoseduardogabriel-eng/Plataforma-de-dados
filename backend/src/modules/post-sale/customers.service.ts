import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        ...dto,
        organizationId,
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined,
      },
    });
  }

  findAll(
    organizationId: string,
    filters: { status?: string; churnRiskLevel?: string; search?: string },
  ) {
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      status: filters.status as any,
      churnRiskLevel: filters.churnRiskLevel as any,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { document: { contains: filters.search } },
          ]
        : undefined,
    };
    return this.prisma.customer.findMany({
      where,
      orderBy: [{ churnRiskScore: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        contracts: { orderBy: { startDate: 'desc' } },
        interactions: { orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { id: true, name: true } } } },
        churnSignals: { orderBy: { createdAt: 'desc' } },
        transactions: { orderBy: { dueDate: 'desc' }, take: 10 },
      },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    return customer;
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(organizationId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined,
      },
    });
  }
}
