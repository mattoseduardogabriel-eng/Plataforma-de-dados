import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { CloseDealDto } from './dto/close-deal.dto';
import { LiroCrmService } from '../integrations/liro-crm/liro-crm.service';
import { normalizePhone } from '../../common/utils/phone.util';
import { AuditService } from '../audit/audit.service';

const DEAL_INCLUDE = {
  stage: true,
  pipeline: true,
  owner: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true, document: true, documentType: true, phone: true, email: true, companyName: true } },
} satisfies Prisma.DealInclude;

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liroCrmService: LiroCrmService,
    private readonly auditService: AuditService,
  ) {}

  async create(organizationId: string, ownerId: string, dto: CreateDealDto) {
    const leadId = dto.leadId ?? (await this.resolveOrCreateLead(organizationId, ownerId, dto));

    const deal = await this.prisma.deal.create({
      data: {
        organizationId,
        title: dto.title,
        leadId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        productPlan: dto.productPlan,
        value: dto.value,
        ownerId: dto.ownerId ?? ownerId,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
      },
      include: DEAL_INCLUDE,
    });

    // Igual ao move() — o negócio já nasce numa etapa, então precisa
    // refletir no Liro CRM desde a criação, não só quando é arrastado
    // depois. Melhor esforço, não bloqueia a resposta (ver
    // LiroCrmService.pushStageForDeal).
    this.liroCrmService.pushStageForDeal(organizationId, deal.id).catch(() => {});

    return deal;
  }

  /**
   * "Nova negociação" pode vir com nome/telefone/CNPJ digitados na hora,
   * em vez de escolher um lead já existente (ver CreateDealDto) — a
   * negociação nasce vinculada ao lead mesmo assim, pra alimentar
   * Pós-venda quando fechar (ver markWon, que pega nome/documento/telefone
   * do lead) e pra dar pra sincronizar com o Liro CRM depois. Casa por
   * telefone pra não duplicar quem já existe; sem telefone, sempre cria
   * um lead novo (não tem chave segura pra achar um já existente).
   */
  private async resolveOrCreateLead(
    organizationId: string,
    createdById: string,
    dto: CreateDealDto,
  ): Promise<string | undefined> {
    if (!dto.contactName?.trim() && !dto.contactPhone?.trim()) return undefined;

    // Normalizado (55 + DDD + 9 dígitos) — pra "44998771425" e
    // "5544998771425" (ou sem o 9º dígito) casarem com o mesmo lead em
    // vez de criar dois (ver phone.util.ts).
    const phone = dto.contactPhone?.trim() ? (normalizePhone(dto.contactPhone.trim()) ?? undefined) : undefined;
    if (phone) {
      const existente = await this.prisma.lead.findFirst({ where: { organizationId, phone } });
      if (existente) return existente.id;
    }

    const documento = dto.contactDocument?.trim() || undefined;
    const documentType = documento ? (documento.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF') : undefined;

    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        name: dto.contactName?.trim() || phone || dto.title,
        phone,
        document: documento,
        documentType,
        source: 'Funil de Vendas',
        createdById,
      },
    });
    return lead.id;
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

  async move(organizationId: string, id: string, stageId: string, userId: string) {
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
      await this.markWon(organizationId, updated, userId);
    } else if (stage.isLost && deal.status !== 'PERDIDO') {
      await this.prisma.deal.update({
        where: { id },
        data: { status: 'PERDIDO', closedAt: new Date() },
      });
    }

    // Melhor esforço, não bloqueia a resposta nem derruba o move se falhar
    // (ver LiroCrmService.pushStageForDeal) — reflete a etapa nova no Liro
    // CRM só se houver mapeamento configurado e o lead já tiver conversa
    // aberta por lá.
    this.liroCrmService.pushStageForDeal(organizationId, id).catch(() => {});

    return this.findOne(organizationId, id);
  }

  /**
   * Remove negociações do Funil de Vendas de uma vez (seleção em retângulo
   * no quadro) — mesma semântica de "conversa excluída no Liro" (ver
   * LiroCrmService.removerDoFunilPorConversaExcluida): apaga só o(s)
   * Deal(s), o Lead de origem continua existindo e pode voltar pro funil
   * depois em "Adicionar ao Funil de Vendas". `deleteMany` já é escopado
   * por organizationId, então um id de outra organização não é apagado.
   */
  async removeMany(organizationId: string, userId: string, ids: string[]) {
    const result = await this.prisma.deal.deleteMany({
      where: { organizationId, id: { in: ids } },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'DEAL_REMOVED_FROM_FUNNEL',
      entityType: 'Deal',
      metadata: { requested: ids.length, removed: result.count } as Prisma.InputJsonValue,
    });

    return { removed: result.count };
  }

  async close(organizationId: string, id: string, dto: CloseDealDto, userId: string) {
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
      await this.markWon(organizationId, updated, userId);
    }

    return this.findOne(organizationId, id);
  }

  /**
   * Converte uma negociação ganha em cliente ativo no módulo de pós-venda,
   * evitando duplicidade — este é o ponto de cruzamento entre CRM,
   * Pós-venda e Financeiro: a venda fechada já nasce com carteira de
   * cliente, contrato e o lançamento de receita correspondente.
   */
  private async markWon(
    organizationId: string,
    deal: { id: string; title: string; value: any; productPlan: string | null; leadId: string | null },
    userId: string,
  ) {
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

    // Registra o valor da venda como receita no Financeiro — evita ter que
    // lançar manualmente todo negócio fechado. Só cria se houver valor
    // (negócio sem valor definido não gera lançamento vazio).
    const amount = Number(deal.value);
    if (amount > 0) {
      await this.prisma.transaction.create({
        data: {
          organizationId,
          type: 'RECEITA',
          description: `Venda fechada: ${deal.title}`,
          amount: deal.value,
          dueDate: new Date(),
          status: 'PENDENTE',
          customerId: customer.id,
          createdById: userId,
        },
      });
    }
  }
}
