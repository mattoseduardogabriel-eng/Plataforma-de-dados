import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateContractDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    return this.prisma.contract.create({
      data: {
        organizationId,
        customerId: dto.customerId,
        planName: dto.planName,
        value: dto.value,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? 'ATIVO',
        fileUrl: dto.fileUrl,
      },
    });
  }

  findAll(organizationId: string, customerId?: string) {
    return this.prisma.contract.findMany({
      where: { organizationId, customerId },
      orderBy: { startDate: 'desc' },
    });
  }
}
