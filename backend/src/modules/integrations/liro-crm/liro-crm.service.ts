import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SecretCipher } from '../../../common/crypto/secret-cipher';
import { AuditService } from '../../audit/audit.service';
import { LiroCrmConnector, LiroCredentials } from './liro-crm.connector';
import { SaveLiroCrmCredentialsDto } from './dto/save-credentials.dto';
import { SetStageMappingDto } from './dto/set-stage-mapping.dto';
import { LiroContact } from './liro-crm.connector';

/**
 * Extrai o nome do operador/atendente responsável pelo contato no Liro CRM,
 * de forma best-effort — a "API externa" documentada não define esse campo
 * explicitamente, então tentamos os nomes mais prováveis que a resposta
 * pode trazer. Sem contrato oficial, isso é só informativo (exibido no
 * lead), nunca usado pra decidir nada. Ajustar aqui se o nome real do
 * campo, quando confirmado com a documentação do Liro, for diferente.
 */
function extractOperatorName(contact: LiroContact): string | undefined {
  const candidates = [
    contact.operatorName,
    contact.operator,
    contact.responsibleName,
    contact.responsavel,
    contact.assignedOperator,
    contact.attendantName,
  ];
  const found = candidates.find((v) => typeof v === 'string' && v.trim().length > 0);
  return typeof found === 'string' ? found : undefined;
}

@Injectable()
export class LiroCrmService {
  private readonly logger = new Logger(LiroCrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
    private readonly connector: LiroCrmConnector,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async status(organizationId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    if (!org.liroCrmApiKeyEncrypted || !org.liroCrmBaseUrl) {
      return { configured: false as const };
    }
    const apiKey = this.cipher.decrypt(org.liroCrmApiKeyEncrypted);
    return {
      configured: true as const,
      baseUrl: org.liroCrmBaseUrl,
      apiKeySuffix: SecretCipher.maskSuffix(apiKey),
      lastSyncedAt: org.liroCrmLastSyncedAt,
    };
  }

  async saveCredentials(organizationId: string, userId: string, dto: SaveLiroCrmCredentialsDto) {
    const creds: LiroCredentials = { apiKey: dto.apiKey, baseUrl: dto.baseUrl };
    // Valida a chave contra a API real antes de gravar — evita salvar uma credencial quebrada.
    await this.connector.listTags(creds);

    // Token opaco da URL de webhook — gerado uma vez só, reaproveitado em
    // reconexões (não precisa trocar só porque a pessoa reconectou).
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const webhookToken = org.liroWebhookToken ?? randomBytes(24).toString('hex');

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        liroCrmApiKeyEncrypted: this.cipher.encrypt(dto.apiKey),
        liroCrmBaseUrl: dto.baseUrl,
        liroWebhookToken: webhookToken,
      },
    });

    // Melhor esforço: registra nosso próprio endpoint pra sermos avisados
    // em tempo real quando uma conversa muda de etapa no Liro. Não pode
    // derrubar a conexão se isso falhar (ex.: versão do Liro ainda sem
    // POST /webhooks, ou PUBLIC_API_URL não configurada aqui) — o resto da
    // integração (sync manual, tags) continua funcionando sem isso, só o
    // lado Liro → Aster do sincronismo de funil fica sem tempo real.
    const publicUrl = this.configService.get<string>('PUBLIC_API_URL');
    if (publicUrl) {
      try {
        await this.connector.registerWebhook(creds, `${publicUrl.replace(/\/+$/, '')}/api/integrations/liro-crm/webhook/${webhookToken}`);
      } catch (error) {
        this.logger.warn(
          `Não foi possível registrar o webhook de mudança de etapa no Liro CRM (org ${organizationId}): ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    } else {
      this.logger.warn('PUBLIC_API_URL não configurada — pulo o registro automático do webhook de mudança de etapa no Liro CRM.');
    }

    await this.auditService.log({
      organizationId,
      userId,
      action: 'LIRO_CRM_CREDENTIALS_SAVED',
      entityType: 'Organization',
      entityId: organizationId,
    });

    return this.status(organizationId);
  }

  async removeCredentials(organizationId: string, userId: string) {
    await this.prisma.organization.update({
      where: { id: organizationId },
      // liroWebhookToken também zera: o token antigo não pode continuar
      // valendo pra receber chamadas depois de desconectado, e reconectar
      // gera um novo (ver saveCredentials).
      data: { liroCrmApiKeyEncrypted: null, liroCrmBaseUrl: null, liroCrmLastSyncedAt: null, liroWebhookToken: null },
    });
    await this.auditService.log({
      organizationId,
      userId,
      action: 'LIRO_CRM_CREDENTIALS_REMOVED',
      entityType: 'Organization',
      entityId: organizationId,
    });
    return { configured: false as const };
  }

  private async getCredentials(organizationId: string): Promise<LiroCredentials> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org?.liroCrmApiKeyEncrypted || !org.liroCrmBaseUrl) {
      throw new BadRequestException('Integração com o Liro CRM não configurada para esta organização.');
    }
    return { apiKey: this.cipher.decrypt(org.liroCrmApiKeyEncrypted), baseUrl: org.liroCrmBaseUrl };
  }

  async testConnection(organizationId: string) {
    const creds = await this.getCredentials(organizationId);
    await this.connector.listTags(creds);
    return { success: true };
  }

  /**
   * Importa contatos do Liro CRM como Leads (upsert por telefone/liroContactId).
   * Usa `since` = última sincronização, para trazer só quem mudou.
   */
  async syncContacts(organizationId: string, userId: string) {
    const creds = await this.getCredentials(organizationId);
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
    const since = org.liroCrmLastSyncedAt?.toISOString();

    const contacts = await this.connector.listContacts(creds, { since, limit: 500 });
    this.logger.log(
      `Sync Liro CRM (org ${organizationId}): ${contacts.length} contato(s) recebido(s) da API` +
        (since ? ` desde ${since}` : ' (primeira sincronização, sem filtro de data)') +
        (contacts.length === 0
          ? ' — se você esperava contatos aqui, confirme o formato real da resposta de GET /contacts contra a API do Liro.'
          : '.'),
    );

    let created = 0;
    let updated = 0;
    for (const contact of contacts) {
      if (!contact.phoneNumber) continue;

      const documentType: DocumentType | undefined = contact.cnpj ? 'CNPJ' : contact.cpf ? 'CPF' : undefined;
      const document = contact.cnpj ?? contact.cpf ?? undefined;
      const operatorName = extractOperatorName(contact);

      const existing = await this.prisma.lead.findFirst({
        where: {
          organizationId,
          OR: [{ liroContactId: contact.id }, { phone: contact.phoneNumber }],
        },
      });

      if (existing) {
        await this.prisma.lead.update({
          where: { id: existing.id },
          data: {
            name: contact.name || existing.name,
            companyName: contact.companyName ?? existing.companyName,
            document: document ?? existing.document,
            documentType: documentType ?? existing.documentType,
            liroContactId: contact.id,
            liroOperatorName: operatorName ?? existing.liroOperatorName,
          },
        });
        updated += 1;
      } else {
        await this.prisma.lead.create({
          data: {
            organizationId,
            name: contact.name || contact.phoneNumber,
            phone: contact.phoneNumber,
            companyName: contact.companyName,
            document,
            documentType,
            source: 'Liro CRM',
            liroContactId: contact.id,
            liroOperatorName: operatorName,
            createdById: userId,
          },
        });
        created += 1;
      }
    }

    // Marca-d'água da próxima sincronização incremental: usamos o `updatedAt`
    // mais recente ENTRE OS CONTATOS RECEBIDOS, nunca o relógio de agora.
    // Motivo: se stampássemos sempre `new Date()`, uma sincronização que por
    // qualquer razão transitória viesse vazia (API fora do ar, deploy do
    // Liro ainda propagando, banco temporariamente errado) "envenenaria" o
    // `since` pra sempre — toda sincronização seguinte passaria a filtrar
    // só contatos atualizados DEPOIS desse carimbo, escondendo pra sempre
    // contatos que já existiam e nunca mais tocaram. Só avançamos o
    // carimbo quando realmente veio gente na resposta, e usando a data real
    // dos dados — nunca regride, mesmo se algum contato vier com
    // `updatedAt` corrompido/ausente.
    if (contacts.length > 0) {
      const maisRecente = contacts.reduce<Date | undefined>((max, contact) => {
        const bruto = contact.updatedAt;
        if (typeof bruto !== 'string') return max;
        const data = new Date(bruto);
        if (Number.isNaN(data.getTime())) return max;
        return !max || data > max ? data : max;
      }, org.liroCrmLastSyncedAt ?? undefined);

      if (maisRecente) {
        await this.prisma.organization.update({
          where: { id: organizationId },
          data: { liroCrmLastSyncedAt: maisRecente },
        });
      }
    }

    await this.auditService.log({
      organizationId,
      userId,
      action: 'LIRO_CRM_SYNC_CONTACTS',
      entityType: 'Lead',
      metadata: { created, updated, total: contacts.length } as Prisma.InputJsonValue,
    });

    return { created, updated, total: contacts.length };
  }

  /** Aplica uma tag no contato do Liro CRM vinculado a um lead, criando o vínculo (upsert por telefone) se ainda não existir. */
  async pushTagForLead(organizationId: string, userId: string, leadId: string, tagName: string) {
    const creds = await this.getCredentials(organizationId);
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) {
      throw new NotFoundException('Lead não encontrado.');
    }

    const contactId = await this.ensureContactId(creds, lead);
    await this.connector.tagContact(creds, contactId, tagName);

    await this.auditService.log({
      organizationId,
      userId,
      action: 'LIRO_CRM_TAG_PUSHED',
      entityType: 'Lead',
      entityId: lead.id,
      metadata: { tagName } as Prisma.InputJsonValue,
    });

    return { success: true };
  }

  private async ensureContactId(
    creds: LiroCredentials,
    lead: { id: string; phone: string | null; name: string; document: string | null; documentType: DocumentType | null; companyName: string | null; liroContactId: string | null },
  ): Promise<string> {
    if (lead.liroContactId) return lead.liroContactId;
    if (!lead.phone) {
      throw new BadRequestException('Lead sem telefone — não é possível vincular ao Liro CRM.');
    }
    const contact = await this.connector.upsertContact(creds, {
      phoneNumber: lead.phone,
      name: lead.name,
      cnpj: lead.documentType === 'CNPJ' ? lead.document : undefined,
      cpf: lead.documentType === 'CPF' ? lead.document : undefined,
      companyName: lead.companyName ?? undefined,
    });
    await this.prisma.lead.update({ where: { id: lead.id }, data: { liroContactId: contact.id } });
    return contact.id;
  }

  /**
   * Melhor esforço: espelha o resultado de uma decisão do Crivo (ou de uma
   * consulta de inteligência de dados) como tag no contato correspondente
   * do Liro CRM, quando existir um lead com esse documento. Nunca lança —
   * uma falha aqui não pode derrubar o fluxo principal (avaliação de
   * crédito, consulta), só fica registrada no log.
   */
  async tryTagByDocument(organizationId: string, targetDocument: string, tagName: string): Promise<void> {
    try {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org?.liroCrmApiKeyEncrypted || !org.liroCrmBaseUrl) return;

      const lead = await this.prisma.lead.findFirst({ where: { organizationId, document: targetDocument } });
      if (!lead) return;

      const creds: LiroCredentials = { apiKey: this.cipher.decrypt(org.liroCrmApiKeyEncrypted), baseUrl: org.liroCrmBaseUrl };
      const contactId = await this.ensureContactId(creds, lead);
      await this.connector.tagContact(creds, contactId, tagName);
    } catch (error) {
      this.logger.warn(
        `Não foi possível espelhar tag "${tagName}" no Liro CRM para o documento ${targetDocument}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  // --- Sincronização de funil (bidirecional) ---
  // Aster → Liro: pushStageForDeal(), chamado por deals.service.ts depois
  // de mover um negócio manualmente. Liro → Aster: handleInboundWebhook(),
  // chamado pelo controller quando o Liro avisa (POST .../webhook/:token)
  // que uma conversa mudou de etapa lá. As duas pontas usam o mesmo
  // mapeamento (PipelineStage.liroKanbanStageId), configurado manualmente
  // em Configurações > Integrações — nomes de etapa são livres nos dois
  // sistemas, então não dá pra casar por nome com segurança.

  /** Etapas do Kanban do Liro, pra montar a tela de mapeamento. */
  async listKanbanStages(organizationId: string) {
    const creds = await this.getCredentials(organizationId);
    return this.connector.listKanbanStages(creds);
  }

  async setStageMapping(organizationId: string, pipelineStageId: string, dto: SetStageMappingDto) {
    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: pipelineStageId, pipeline: { organizationId } },
    });
    if (!stage) {
      throw new NotFoundException('Etapa do funil não encontrada.');
    }
    return this.prisma.pipelineStage.update({
      where: { id: pipelineStageId },
      data: {
        liroKanbanStageId: dto.liroKanbanStageId ?? null,
        liroKanbanStageName: dto.liroKanbanStageId ? (dto.liroKanbanStageName ?? null) : null,
      },
    });
  }

  /**
   * Melhor esforço, nunca lança: chamado depois de mover um negócio no
   * Kanban do Aster. Só reflete no Liro se (a) a etapa de destino tiver
   * mapeamento configurado e (b) o lead do negócio já tiver
   * `liroContactId` — sem isso não tem o que mover lá. Um 404 do Liro
   * (contato sem conversa aberta) é esperado e tratado como "nada a
   * fazer", não como erro — é exatamente o caso que a pessoa descreveu:
   * lead sem conversa aberta não deve refletir no Liro.
   */
  async pushStageForDeal(organizationId: string, dealId: string): Promise<void> {
    try {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org?.liroCrmApiKeyEncrypted || !org.liroCrmBaseUrl) return;

      const deal = await this.prisma.deal.findFirst({
        where: { id: dealId, organizationId },
        include: { stage: true, lead: true },
      });
      if (!deal?.stage.liroKanbanStageId || !deal.lead?.liroContactId) return;

      const creds: LiroCredentials = { apiKey: this.cipher.decrypt(org.liroCrmApiKeyEncrypted), baseUrl: org.liroCrmBaseUrl };
      await this.connector.moveContactKanbanStage(creds, deal.lead.liroContactId, deal.stage.liroKanbanStageId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.debug(`Deal ${dealId}: contato sem conversa aberta no Liro CRM, nada a refletir.`);
        return;
      }
      this.logger.warn(
        `Não foi possível refletir a etapa do negócio ${dealId} no Liro CRM: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Recebe o aviso do Liro (POST /api/integrations/liro-crm/webhook/:token)
   * de que uma conversa mudou de etapa por lá — arrastar o card no
   * Kanban do Liro, ou qualquer outro jeito de mover de lá. Acha o lead
   * pelo `liroContactId` (ou telefone, se o lead ainda não tinha o
   * vínculo gravado), acha o negócio aberto mais recente desse lead, e
   * move ele pra etapa mapeada — direto no banco, sem passar por
   * moveDeal(), justamente pra não disparar de volta um push pro Liro
   * (senão vira ping-pong infinito entre os dois lados).
   */
  async handleInboundWebhook(token: string, payload: Record<string, unknown>): Promise<void> {
    if (payload.event !== 'conversation_moved') return;

    const org = await this.prisma.organization.findFirst({ where: { liroWebhookToken: token } });
    if (!org) {
      this.logger.warn('Webhook do Liro CRM recebido com token desconhecido — ignorado.');
      return;
    }

    const contact = payload.contact as { id?: string; phoneNumber?: string } | undefined;
    const conversation = payload.conversation as { kanbanStage?: { id?: string } } | undefined;
    const liroStageId = conversation?.kanbanStage?.id;
    if (!contact || !liroStageId) return;

    const lead = await this.prisma.lead.findFirst({
      where: {
        organizationId: org.id,
        OR: [
          ...(contact.id ? [{ liroContactId: contact.id }] : []),
          ...(contact.phoneNumber ? [{ phone: contact.phoneNumber }] : []),
        ],
      },
    });
    if (!lead) return;

    const deal = await this.prisma.deal.findFirst({
      where: { organizationId: org.id, leadId: lead.id, status: 'ABERTO' },
      orderBy: { updatedAt: 'desc' },
      include: { pipeline: true },
    });
    if (!deal) return;

    const etapaAlvo = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId: deal.pipelineId, liroKanbanStageId: liroStageId },
    });
    if (!etapaAlvo || etapaAlvo.id === deal.stageId) return;

    await this.prisma.deal.update({ where: { id: deal.id }, data: { stageId: etapaAlvo.id } });
    await this.auditService.log({
      organizationId: org.id,
      // Sem userId: veio de fora, não de uma ação de alguém logado.
      userId: undefined,
      action: 'LIRO_CRM_STAGE_SYNCED_FROM_LIRO',
      entityType: 'Deal',
      entityId: deal.id,
      metadata: { liroKanbanStageId: liroStageId, newStageId: etapaAlvo.id } as Prisma.InputJsonValue,
    });
  }
}
