import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';

const ACTIVITY_INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true } },
  deal: { select: { id: true, title: true } },
} satisfies Prisma.ActivityInclude;

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, createdById: string, dto: CreateActivityDto) {
    return this.prisma.activity.create({
      data: {
        organizationId,
        createdById,
        type: dto.type,
        title: dto.title,
        notes: dto.notes,
        dealId: dto.dealId,
        leadId: dto.leadId,
        assignedToId: dto.assignedToId ?? createdById,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: ACTIVITY_INCLUDE,
    });
  }

  findAll(organizationId: string, filters: { dealId?: string; leadId?: string; assignedToId?: string }) {
    return this.prisma.activity.findMany({
      where: {
        organizationId,
        dealId: filters.dealId,
        leadId: filters.leadId,
        assignedToId: filters.assignedToId,
      },
      include: ACTIVITY_INCLUDE,
      // Pendentes primeiro (doneAt null), ordenadas por prazo; concluídas por último.
      orderBy: [{ doneAt: { sort: 'asc', nulls: 'first' } }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async markDone(organizationId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id, organizationId } });
    if (!activity) {
      throw new NotFoundException('Atividade não encontrada.');
    }
    return this.prisma.activity.update({ where: { id }, data: { doneAt: new Date() } });
  }
}
