import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const LEAD_INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  sector: true,
  additionalAssignees: { include: { user: { select: { id: true, name: true } } } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, createdById: string, dto: CreateLeadDto) {
    const { additionalAssigneeIds, ...rest } = dto;
    const lead = await this.prisma.lead.create({
      data: {
        ...rest,
        organizationId,
        createdById,
        additionalAssignees: additionalAssigneeIds?.length
          ? { create: additionalAssigneeIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: LEAD_INCLUDE,
    });
    return lead;
  }

  async findAll(
    organizationId: string,
    filters: { status?: string; assignedToId?: string; search?: string },
  ) {
    const where: Prisma.LeadWhereInput = {
      organizationId,
      status: filters.status as any,
      // Responsável principal OU atribuído como pessoa adicional — filtrar
      // por "meus leads" não pode perder quem só está na lista extra.
      OR: filters.assignedToId
        ? [
            { assignedToId: filters.assignedToId },
            { additionalAssignees: { some: { userId: filters.assignedToId } } },
          ]
        : filters.search
          ? [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { document: { contains: filters.search } },
              { companyName: { contains: filters.search, mode: 'insensitive' } },
            ]
          : undefined,
    };
    return this.prisma.lead.findMany({
      where,
      include: LEAD_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        ...LEAD_INCLUDE,
        deals: { include: { stage: true } },
        activities: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead não encontrado.');
    }
    return lead;
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto) {
    await this.findOne(organizationId, id);
    const { additionalAssigneeIds, ...rest } = dto;

    if (additionalAssigneeIds !== undefined) {
      // Substitui o conjunto inteiro — mais simples e previsível do que
      // tentar diff incremental, e o front sempre manda a lista completa.
      await this.prisma.leadAssignee.deleteMany({ where: { leadId: id } });
      if (additionalAssigneeIds.length) {
        await this.prisma.leadAssignee.createMany({
          data: additionalAssigneeIds.map((userId) => ({ leadId: id, userId })),
          skipDuplicates: true,
        });
      }
    }

    return this.prisma.lead.update({ where: { id }, data: rest, include: LEAD_INCLUDE });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.lead.update({ where: { id }, data: { status: 'DESCARTADO' } });
    return { success: true };
  }
}
