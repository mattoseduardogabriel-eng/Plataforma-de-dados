import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { normalizePhone } from '../../common/utils/phone.util';

export type SaveToWalletResultado =
  | { leadId: string; status: 'criado'; customerId: string }
  | { leadId: string; status: 'ja_estava_na_carteira'; customerId: string }
  | { leadId: string; status: 'nao_encontrado' };

const LEAD_INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  sector: true,
  additionalAssignees: { include: { user: { select: { id: true, name: true } } } },
  // Só o id: a lista de leads usa isso pra saber se mostra "Salvar na
  // carteira" ou "Já está na carteira" (ver Customer.leadId), sem precisar
  // buscar o cliente inteiro.
  customer: { select: { id: true } },
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

  /**
   * Acha o lead pelo telefone — usado pelo deep-link "abrir no Aster"
   * clicado de dentro de uma conversa do Liro CRM. Normaliza antes de
   * comparar (mesmo padrão usado na sincronização) pra achar mesmo que o
   * telefone tenha sido salvo num formato ligeiramente diferente aqui.
   * Quando mais de um lead bate (não deveria, mas dado legado pode
   * duplicar), devolve o mais recente.
   */
  async findByPhone(organizationId: string, phone: string | undefined) {
    if (!phone) {
      throw new NotFoundException('Informe um telefone para buscar.');
    }
    const normalized = normalizePhone(phone) ?? phone;
    const digits = phone.replace(/\D/g, '');
    const orConditions: Prisma.LeadWhereInput[] = [{ phone: normalized }];
    if (digits) orConditions.push({ phone: { contains: digits } });
    const lead = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        OR: orConditions,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!lead) {
      throw new NotFoundException('Nenhum lead encontrado com esse telefone.');
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

  /**
   * "Salvar na carteira" — cria um Customer (Pós-venda) direto a partir de
   * um lead, sem passar pelo funil de vendas/negociação (esse é o caminho
   * automático de markWon() em deals.service.ts; este aqui é o manual, pra
   * quando o lead já é reconhecidamente um cliente — ex.: veio sincronizado
   * do Liro CRM). O nome pode ser corrigido na hora de salvar (o contato do
   * WhatsApp às vezes não tem nome, só telefone). `Customer.leadId` é
   * @unique, então nunca duplica: se o lead já tiver sido salvo antes,
   * lança ConflictException com o id do cliente já existente, pro
   * chamador poder avisar "já está na carteira" em vez de tentar de novo.
   */
  async saveToWallet(organizationId: string, id: string, name?: string) {
    const lead = await this.findOne(organizationId, id);
    if (lead.customer) {
      throw new ConflictException({
        message: 'Este lead já está na carteira de clientes.',
        customerId: lead.customer.id,
      });
    }

    const nomeFinal = name?.trim() || lead.name;
    return this.prisma.customer.create({
      data: {
        organizationId,
        name: nomeFinal,
        document: lead.document,
        documentType: lead.documentType,
        email: lead.email,
        phone: lead.phone,
        liroContactId: lead.liroContactId,
        status: 'ATIVO',
        leadId: lead.id,
      },
    });
  }

  /**
   * Mesma coisa em massa (checkbox de seleção na lista de leads) — nunca
   * lança: cada item do lote vira um resultado próprio ('criado',
   * 'ja_estava_na_carteira' ou 'nao_encontrado'), pro front poder mostrar
   * "N salvos, M já estavam na carteira" sem um item ruim derrubar o lote
   * inteiro.
   */
  async saveManyToWallet(
    organizationId: string,
    items: { leadId: string; name?: string }[],
  ): Promise<SaveToWalletResultado[]> {
    const resultados: SaveToWalletResultado[] = [];
    for (const item of items) {
      try {
        const customer = await this.saveToWallet(organizationId, item.leadId, item.name);
        resultados.push({ leadId: item.leadId, status: 'criado', customerId: customer.id });
      } catch (err) {
        if (err instanceof ConflictException) {
          const resposta = err.getResponse() as { customerId: string };
          resultados.push({ leadId: item.leadId, status: 'ja_estava_na_carteira', customerId: resposta.customerId });
        } else if (err instanceof NotFoundException) {
          resultados.push({ leadId: item.leadId, status: 'nao_encontrado' });
        } else {
          throw err;
        }
      }
    }
    return resultados;
  }
}
