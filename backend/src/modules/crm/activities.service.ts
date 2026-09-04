import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { LiroCrmService } from '../integrations/liro-crm/liro-crm.service';

const ACTIVITY_INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true } },
  deal: { select: { id: true, title: true } },
} satisfies Prisma.ActivityInclude;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liroCrmService: LiroCrmService,
  ) {}

  async create(organizationId: string, createdById: string, dto: CreateActivityDto) {
    const activity = await this.prisma.activity.create({
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

    // Sincronização de tarefas com o Liro CRM — melhor esforço, não
    // bloqueia a resposta (ver LiroCrmService.pushTaskCreate).
    this.liroCrmService.pushTaskCreate(organizationId, activity.id).catch(() => {});

    return activity;
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
    const updated = await this.prisma.activity.update({ where: { id }, data: { doneAt: new Date() } });

    // Reflete no Liro mesmo pra uma tarefa que nasceu lá (origin='liro')
    // — a pessoa pode ter concluído por aqui, e o Liro precisa mostrar
    // isso também ("espelha tudo", nas duas direções).
    this.liroCrmService.pushTaskUpdate(organizationId, id).catch(() => {});

    return updated;
  }

  async remove(organizationId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id, organizationId } });
    if (!activity) {
      throw new NotFoundException('Atividade não encontrada.');
    }
    await this.prisma.activity.delete({ where: { id } });
    this.liroCrmService.pushTaskDelete(organizationId, activity.externalId).catch(() => {});
  }

  // "Limpar concluídas" na tela de Tarefas — apaga só as JÁ marcadas como
  // concluídas (doneAt preenchido), escopadas do mesmo jeito que a lista
  // (assignedToId opcional: 'minhas' vs 'todas da equipe'). Nunca mexe em
  // tarefa pendente, mesmo que o filtro passado seja vazio.
  async removeCompleted(organizationId: string, filters: { assignedToId?: string }) {
    const where = { organizationId, assignedToId: filters.assignedToId, doneAt: { not: null } } satisfies Prisma.ActivityWhereInput;
    // Precisa buscar ANTES de apagar — deleteMany não devolve as linhas
    // afetadas, e cada uma precisa do próprio externalId pra empurrar a
    // exclusão pro Liro (ver LiroCrmService.pushTaskDelete).
    const afetadas = await this.prisma.activity.findMany({ where, select: { id: true, externalId: true } });
    const { count } = await this.prisma.activity.deleteMany({ where });

    // Cada exclusão sincroniza pro Liro individualmente, melhor esforço,
    // sem bloquear a resposta desse "limpar tudo".
    for (const atividade of afetadas) {
      this.liroCrmService.pushTaskDelete(organizationId, atividade.externalId).catch(() => {});
    }

    return { removed: count };
  }
}
