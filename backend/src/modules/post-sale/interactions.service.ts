import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';

@Injectable()
export class InteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, createdById: string, dto: CreateInteractionDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    const interaction = await this.prisma.interactionHistory.create({
      data: {
        organizationId,
        createdById,
        customerId: dto.customerId,
        type: dto.type,
        summary: dto.summary,
        notes: dto.notes,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    if (dto.type === 'RECLAMACAO') {
      await this.prisma.churnSignal.create({
        data: {
          organizationId,
          customerId: dto.customerId,
          signalType: 'RECLAMACAO',
          weight: 2,
          notes: dto.summary,
        },
      });
    }

    return interaction;
  }

  findAll(organizationId: string, customerId?: string) {
    return this.prisma.interactionHistory.findMany({
      where: { organizationId, customerId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
