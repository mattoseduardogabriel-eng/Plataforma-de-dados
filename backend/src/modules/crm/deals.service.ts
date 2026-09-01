import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { CloseDealDto } from './dto/close-deal.dto';

const DEAL_INCLUDE = {
  stage: true,
  pipeline: true,
  owner: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true, document: true, documentType: true } },
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, ownerId: string, dto: CreateDealDto) {
    return this.prisma.deal.create({
      data: {
        organizationId,
        title: dto.title,
        leadId: dto.leadId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        productPlan: dto.productPlan,
        value: dto.value,
        ownerId: dto.ownerId ?? ownerId,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
      },
      include: DEAL_INCLUDE,
    });
  }

  findAll(
    organizationId: string,
    filters: { pipelineId?: string; stageId?: string; ownerId?: string; status?: string },
  ) {
    return this.prisma.deal.findMany({
      where: {
        organizationId,
        pipelineId: filters.pipelineId,
        stageId: filters.stageId,
        ownerId: filters.ownerId,
        status: filters.status as any,
      },
      include: DEAL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId },
      include: { ...DEAL_INCLUDE, activities: { orderBy: { createdAt: 'desc' } } },
    });
    if (!deal) {
      throw new NotFoundException('Negociação não encontrada.');
    }
    return deal;
  }

  async update(organizationId: string, id: string, dto: UpdateDealDto) {
    await this.findOne(organizationId, id);
    return this.prisma.deal.update({
      where: { id },
      data: {
        ...dto,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
      },
      include: DEAL_INCLUDE,
    });
  }

  async move(organizationId: string, id: string, stageId: string) {
    const deal = await this.findOne(organizationId, id);
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { organizationId } },
    });
    if (!stage) {
      throw new NotFoundException('Etapa do funil não encontrada.');
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: { stageId },
      include: DEAL_INCLUDE,
    });

    if (stage.isWon && deal.status !== 'GANHO') {
      await this.markWon(organizationId, updated);
    } else if (stage.isLost && deal.status !== 'PERDIDO') {
      await this.prisma.deal.update({
        where: { id },
        data: { status: 'PERDIDO', closedAt: new Date() },
      });
    }

    return this.findOne(organizationId, id);
  }

  async close(organizationId: string, id: string, dto: CloseDealDto) {
    const deal = await this.findOne(organizationId, id);
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId: deal.pipelineId, isWon: dto.outcome === 'GANHO', isLost: dto.outcome === 'PERDIDO' },
    });

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        status: dto.outcome,
        lostReason: dto.outcome === 'PERDIDO' ? dto.lostReason : null,
        closedAt: new Date(),
        stageId: stage?.id ?? deal.stageId,
      },
      include: DEAL_INCLUDE,
    });

    if (dto.outcome === 'GANHO') {
      await this.markWon(organizationId, updated);
    }

    return this.findOne(organizationId, id);
  }

  /**
   * Converte uma negociação ganha em cliente ativo no módulo de pós-venda,
   * evitando duplicidade — este é o ponto de cruzamento entre CRM e
   * Pós-venda: a venda fechada já nasce com carteira de cliente e contrato.
   */
  private async markWon(organizationId: string, deal: { id: string; title: string; value: any; productPlan: string | null; leadId: string | null }) {
    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: 'GANHO', closedAt: new Date() },
    });

    const existingCustomer = await this.prisma.customer.findUnique({ where: { dealId: deal.id } });
    if (existingCustomer) {
      return;
    }

    const lead = deal.leadId
      ? await this.prisma.lead.findUnique({ where: { id: deal.leadId } })
      : null;

    const customer = await this.prisma.customer.create({
      data: {
        organizationId,
        name: lead?.name ?? deal.title,
        document: lead?.document,
        documentType: lead?.documentType,
        email: lead?.email,
        phone: lead?.phone,
        planName: deal.productPlan,
        monthlyValue: deal.value,
        contractStartDate: new Date(),
        status: 'ATIVO',
        dealId: deal.id,
      },
    });

    if (deal.productPlan) {
      await this.prisma.contract.create({
        data: {
          organizationId,
          customerId: customer.id,
          planName: deal.productPlan,
          value: deal.value,
          startDate: new Date(),
          status: 'ATIVO',
        },
      });
    }
  }
}
