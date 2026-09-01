import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, createdById: string, dto: CreateLeadDto) {
    return this.prisma.lead.create({
      data: { ...dto, organizationId, createdById },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
  }

  async findAll(
    organizationId: string,
    filters: { status?: string; assignedToId?: string; search?: string },
  ) {
    const where: Prisma.LeadWhereInput = {
      organizationId,
      status: filters.status as any,
      assignedToId: filters.assignedToId,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { document: { contains: filters.search } },
            { companyName: { contains: filters.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    return this.prisma.lead.findMany({
      where,
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId },
      include: {
        assignedTo: { select: { id: true, name: true } },
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
    return this.prisma.lead.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.lead.update({ where: { id }, data: { status: 'DESCARTADO' } });
    return { success: true };
  }
}
