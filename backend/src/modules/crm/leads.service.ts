import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { normalizePhone } from '../../common/utils/phone.util';
import { normalizePagination } from '../../common/utils/pagination.util';

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
        // Sempre 55 + DDD + 9 dígitos — sem isso, um lead cadastrado à mão
        // (tela de Leads, "Novo lead") fica com o telefone num formato
        // diferente do resto da integração, e casamentos por telefone
        // (webhook do Liro, deep-link "Abrir no Aster") deixam de achar
        // esse lead.
        phone: rest.phone ? (normalizePhone(rest.phone) ?? rest.phone) : rest.phone,
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
    filters: { status?: string; assignedToId?: string; search?: string; page?: number; pageSize?: number },
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
    const { page, pageSize } = normalizePagination(filters.page, filters.pageSize);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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
    const orConditions: Prisma.LeadWhereInput[] = [{ phone: normalized }];
    // Fallback pra lead salvo antes da normalização existir (ou nunca
    // tocado desde então): o telefone salvo pode estar sem o 9º dígito
    // e/ou sem o "55" na frente, mas os 8 dígitos finais (o número em si)
    // são sempre os mesmos — mesmo critério usado no lado do webhook (ver
    // buildPhoneMatchConditions em liro-crm.service.ts).
    const ultimosDigitos = normalized.slice(-8);
    if (ultimosDigitos.length === 8) orConditions.push({ phone: { endsWith: ultimosDigitos } });
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

  /**
   * Mescla o lead achado pelo telefone (`otherPhone`) DENTRO do lead `id`
   * — resolve o caso de dado legado duplicado (o mesmo telefone virou
   * dois leads separados, um pela sincronização, outro criado manualmente
   * antes da normalização existir), que nenhuma correção de matching
   * sozinha desfaz: editar um dos dois nunca refletia no outro porque são
   * registros diferentes de verdade.
   *
   * Negócios e atividades do lead absorvido passam a apontar pro lead
   * sobrevivente; campos em branco do sobrevivente são preenchidos com o
   * valor do absorvido (nunca sobrescreve o que já está preenchido). Se
   * os dois já tiverem cliente na carteira (Customer.leadId, @unique),
   * não dá pra decidir sozinho qual descartar — lança erro pedindo pra
   * resolver manualmente em vez de arriscar perder histórico de um dos
   * dois clientes.
   */
  async mergeByPhone(organizationId: string, id: string, otherPhone: string) {
    const keep = await this.findOne(organizationId, id);

    const normalized = normalizePhone(otherPhone) ?? otherPhone;
    const orConditions: Prisma.LeadWhereInput[] = [{ phone: normalized }];
    const ultimosDigitos = normalized.slice(-8);
    if (ultimosDigitos.length === 8) orConditions.push({ phone: { endsWith: ultimosDigitos } });

    const other = await this.prisma.lead.findFirst({
      where: { organizationId, id: { not: id }, OR: orConditions },
      include: { customer: { select: { id: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    if (!other) {
      throw new NotFoundException('Nenhum outro lead encontrado com esse telefone.');
    }
    if (keep.customer && other.customer) {
      throw new ConflictException(
        'Os dois leads já têm cliente na carteira vinculado — não dá pra mesclar automaticamente sem risco de perder histórico. Resolva manualmente qual carteira manter.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.deal.updateMany({ where: { leadId: other.id }, data: { leadId: keep.id } }),
      this.prisma.activity.updateMany({ where: { leadId: other.id }, data: { leadId: keep.id } }),
      this.prisma.leadAssignee.deleteMany({ where: { leadId: other.id } }),
      ...(other.customer
        ? [this.prisma.customer.update({ where: { id: other.customer.id }, data: { leadId: keep.id } })]
        : []),
      this.prisma.lead.update({
        where: { id: keep.id },
        data: {
          name: keep.name || other.name,
          email: keep.email ?? other.email,
          document: keep.document ?? other.document,
          documentType: keep.documentType ?? other.documentType,
          companyName: keep.companyName ?? other.companyName,
          source: keep.source ?? other.source,
          liroContactId: keep.liroContactId ?? other.liroContactId,
        },
      }),
      this.prisma.lead.delete({ where: { id: other.id } }),
    ]);

    return this.findOne(organizationId, keep.id);
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

    return this.prisma.lead.update({
      where: { id },
      data: { ...rest, phone: rest.phone ? (normalizePhone(rest.phone) ?? rest.phone) : rest.phone },
      include: LEAD_INCLUDE,
    });
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
