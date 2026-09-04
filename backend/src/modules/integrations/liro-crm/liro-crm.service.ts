import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SecretCipher } from '../../../common/crypto/secret-cipher';
import { AuditService } from '../../audit/audit.service';
import { LiroCrmConnector, LiroCredentials, UpsertLiroTaskInput } from './liro-crm.connector';
import { SaveLiroCrmCredentialsDto } from './dto/save-credentials.dto';
import { SetStageMappingDto } from './dto/set-stage-mapping.dto';
import { LiroContact } from './liro-crm.connector';
import { normalizePhone } from '../../../common/utils/phone.util';
import { RealtimeService } from '../../realtime/realtime.service';

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

/**
 * Condições OR pra achar o Lead de um contato do Liro por id vinculado ou
 * telefone. Além do telefone normalizado exato, cai num fallback pelos 8
 * dígitos finais (o número em si, sem DDD nem DDI) — cobre um Lead salvo
 * antes da normalização existir (ou nunca mais tocado desde então), cujo
 * telefone pode estar sem o 9º dígito e/ou sem o "55" na frente. Essas
 * variações sempre preservam os últimos 8 dígitos, então usá-los como
 * último critério é seguro (duas pessoas com os mesmos 8 dígitos finais
 * mas DDD diferente é praticamente impossível na prática).
 */
function buildPhoneMatchConditions(
  liroContactId: string | undefined,
  phoneNormalizado: string | null | undefined,
): Prisma.LeadWhereInput[] {
  const conditions: Prisma.LeadWhereInput[] = [];
  if (liroContactId) conditions.push({ liroContactId });
  if (phoneNormalizado) {
    conditions.push({ phone: phoneNormalizado });
    const ultimosDigitos = phoneNormalizado.slice(-8);
    if (ultimosDigitos.length === 8) conditions.push({ phone: { endsWith: ultimosDigitos } });
  }
  return conditions;
}

// Dedupe de entrega de webhook — o Liro CRM reenvia a MESMA entrega (corpo
// byte-a-byte idêntico, `firedAt` incluso) até 3 vezes se não receber 2xx a
// tempo (ver dispatch.js/enviarUm no Liro); uma reentrega chegando depois
// da anterior já ter sido processada com sucesso (ex: nosso 200 se perdeu
// na volta, mas processamos igual) reprocessaria o evento do zero sem
// isso. Chave = hash do corpo bruto (mesmo corpo = mesma entrega, byte a
// byte); em memória, TTL curto — cobre bem o caso real (reentrega chega
// minutos depois, no máximo), não pretende ser um registro permanente.
const entregasWebhookVistas = new Map<string, number>(); // hash -> timestamp
const TTL_DEDUPE_WEBHOOK_MS = 10 * 60 * 1000; // 10 minutos

function jaProcessouEssaEntrega(hash: string): boolean {
  const agora = Date.now();
  if (entregasWebhookVistas.size > 5000) {
    for (const [chave, quando] of entregasWebhookVistas) {
      if (agora - quando > TTL_DEDUPE_WEBHOOK_MS) entregasWebhookVistas.delete(chave);
    }
  }
  if (entregasWebhookVistas.has(hash)) return true;
  entregasWebhookVistas.set(hash, agora);
  return false;
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
    private readonly realtimeService: RealtimeService,
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
      // Quando a sincronização rodou de verdade pela última vez — não o
      // carimbo incremental interno (liroCrmLastSyncedAt), que só avança
      // quando vem contato novo e por isso pode ficar "parado" mesmo com
      // sincronizações rodando normalmente sem achar nada novo pra trazer.
      lastSyncedAt: org.liroCrmLastSyncAttemptAt,
      // >= 5 rodadas seguidas do sync automático falhando (ver
      // LiroCrmSyncScheduler) — sinal de problema persistente, não
      // instabilidade passageira. Zera no próximo sucesso.
      syncFailing: org.liroCrmSyncFailureCount >= 5,
      syncFailureCount: org.liroCrmSyncFailureCount,
      lastSyncError: org.liroCrmLastSyncError,
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
        const registro = await this.connector.registerWebhook(
          creds,
          `${publicUrl.replace(/\/+$/, '')}/api/integrations/liro-crm/webhook/${webhookToken}`,
        );
        if (registro.signingSecret) {
          await this.prisma.organization.update({
            where: { id: organizationId },
            data: { liroWebhookSigningSecretEncrypted: this.cipher.encrypt(registro.signingSecret) },
          });
        }
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
      data: {
        liroCrmApiKeyEncrypted: null,
        liroCrmBaseUrl: null,
        liroCrmLastSyncedAt: null,
        liroCrmLastSyncAttemptAt: null,
        liroWebhookToken: null,
        liroWebhookSigningSecretEncrypted: null,
      },
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

    // Primeira etapa do funil padrão da empresa — todo lead NOVO da
    // sincronização já nasce como negócio nela (ver criarNegocioParaLead
    // abaixo), pra aparecer direto no Funil de Vendas sem precisar
    // cadastrar manualmente. Lead que já existia não ganha negócio de
    // novo aqui (só na primeira vez que aparece).
    const primeiraEtapa = await this.prisma.pipelineStage.findFirst({
      where: { pipeline: { organizationId } },
      orderBy: [{ pipeline: { isDefault: 'desc' } }, { order: 'asc' }],
    });

    let created = 0;
    let updated = 0;
    for (const contact of contacts) {
      if (!contact.phoneNumber) continue;
      // Sempre no mesmo formato (55 + DDD + 9 dígitos) — pra casar com um
      // lead já existente mesmo que ele tenha sido criado antes dessa
      // normalização existir, ou por um caminho que ainda não normalizava
      // (ver phone.util.ts).
      const phoneNormalizado = normalizePhone(contact.phoneNumber) ?? contact.phoneNumber;

      const documentType: DocumentType | undefined = contact.cnpj ? 'CNPJ' : contact.cpf ? 'CPF' : undefined;
      const document = contact.cnpj ?? contact.cpf ?? undefined;
      const operatorName = extractOperatorName(contact);

      const existing = await this.prisma.lead.findFirst({
        where: {
          organizationId,
          OR: buildPhoneMatchConditions(contact.id, phoneNormalizado),
        },
        include: { deals: { select: { id: true }, take: 1 } },
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
            // Autocorrige o telefone salvo pro formato normalizado atual —
            // sem isso, um lead criado antes da normalização existir (ou
            // achado só pelo fallback de dígitos finais abaixo) nunca
            // corrige o próprio campo, e continua dependendo do fallback
            // pra sempre em vez de casar direto da próxima vez.
            phone: phoneNormalizado,
          },
        });
        updated += 1;

        // Lead sincronizado antes dessa funcionalidade existir nunca ganhou
        // negócio — cobre retroativamente aqui, pra quem já tinha
        // sincronizado não ficar de fora do Funil de Vendas.
        if (primeiraEtapa && existing.deals.length === 0) {
          await this.prisma.deal.create({
            data: {
              organizationId,
              leadId: existing.id,
              pipelineId: primeiraEtapa.pipelineId,
              stageId: primeiraEtapa.id,
              title: contact.name || existing.name,
              ownerId: userId,
            },
          });
        }
      } else {
        const lead = await this.prisma.lead.create({
          data: {
            organizationId,
            name: contact.name || contact.phoneNumber,
            phone: phoneNormalizado,
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

        // Já nasce como negócio na 1ª etapa do funil, pra aparecer no
        // Funil de Vendas sem precisar cadastrar manualmente — só se a
        // empresa já tiver algum funil configurado (sempre tem, ver seed,
        // mas não custa checar).
        if (primeiraEtapa) {
          await this.prisma.deal.create({
            data: {
              organizationId,
              leadId: lead.id,
              pipelineId: primeiraEtapa.pipelineId,
              stageId: primeiraEtapa.id,
              title: lead.name,
              ownerId: userId,
            },
          });
        }
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
    //
    // liroCrmLastSyncAttemptAt é outra coisa: sempre grava `new Date()`
    // aqui embaixo, rodando ou não vindo contato novo — é o que a tela
    // mostra em "Última sincronização", pra não parecer travada só porque
    // não tinha nada novo pra trazer daquela vez (ver status()).
    let maisRecente: Date | undefined;
    if (contacts.length > 0) {
      maisRecente = contacts.reduce<Date | undefined>((max, contact) => {
        const bruto = contact.updatedAt;
        if (typeof bruto !== 'string') return max;
        const data = new Date(bruto);
        if (Number.isNaN(data.getTime())) return max;
        return !max || data > max ? data : max;
      }, org.liroCrmLastSyncedAt ?? undefined);
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        liroCrmLastSyncAttemptAt: new Date(),
        ...(maisRecente ? { liroCrmLastSyncedAt: maisRecente } : {}),
      },
    });

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
      // Normalizado de novo aqui — defensivo, caso o lead tenha sido
      // gravado antes dessa normalização existir (ver phone.util.ts). O
      // Liro também normaliza do lado dele, então isso garante que os
      // dois lados sempre casem no mesmo formato.
      phoneNumber: normalizePhone(lead.phone) ?? lead.phone,
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
   * Kanban do Aster. Só reflete no Liro se a etapa de destino tiver
   * mapeamento configurado. O lead não precisa já ter `liroContactId` —
   * usa ensureContactId() (mesmo helper do envio de tag) pra achar/criar
   * o contato no Liro por telefone; é por isso que um negócio criado
   * direto no Aster com um telefone que já é conversa real no Liro
   * também sincroniza, mesmo sem ter passado pela sincronização de
   * contatos antes. Um 404 do Liro (contato sem conversa aberta lá,
   * mesmo depois de criado/achado) ou lead sem telefone é esperado e
   * tratado como "nada a fazer", não como erro — é exatamente o caso que
   * a pessoa descreveu: lead sem conversa aberta não deve refletir no
   * Liro.
   */
  async pushStageForDeal(organizationId: string, dealId: string): Promise<void> {
    try {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org?.liroCrmApiKeyEncrypted || !org.liroCrmBaseUrl) return;

      const deal = await this.prisma.deal.findFirst({
        where: { id: dealId, organizationId },
        include: { stage: true, lead: true },
      });
      if (!deal?.stage.liroKanbanStageId || !deal.lead) return;

      const creds: LiroCredentials = { apiKey: this.cipher.decrypt(org.liroCrmApiKeyEncrypted), baseUrl: org.liroCrmBaseUrl };
      const contactId = await this.ensureContactId(creds, deal.lead);
      await this.connector.moveContactKanbanStage(creds, contactId, deal.stage.liroKanbanStageId);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        this.logger.debug(`Deal ${dealId}: sem conversa aberta (ou sem telefone) no Liro CRM, nada a refletir.`);
        return;
      }
      this.logger.warn(
        `Não foi possível refletir a etapa do negócio ${dealId} no Liro CRM: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // --- Sincronização de tarefas (bidirecional) ---
  // Aster → Liro: pushTaskCreate/pushTaskUpdate/pushTaskDelete, chamados
  // por ActivitiesService depois de criar/concluir/excluir uma tarefa
  // (Activity) por aqui. Liro → Aster: handleInboundWebhook() (mesmo
  // endpoint das outras notificações), tratando os eventos
  // task_created/task_updated/task_completed/task_deleted. Casa o
  // responsável/criador pelo E-MAIL do usuário (mesmo e-mail nos dois
  // sistemas) — não existe usuário compartilhado entre Liro e Aster.

  /**
   * Melhor esforço, nunca lança: chamado depois de criar uma tarefa aqui.
   * Só cria do lado do Liro se a integração estiver configurada. Guarda o
   * `id` devolvido pelo Liro em Activity.externalId — toda edição/exclusão
   * futura dessa tarefa usa esse id (ver pushTaskUpdate/pushTaskDelete),
   * nunca cria de novo.
   */
  async pushTaskCreate(organizationId: string, activityId: string): Promise<void> {
    try {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org?.liroCrmApiKeyEncrypted || !org.liroCrmBaseUrl) return;

      const activity = await this.prisma.activity.findFirst({
        where: { id: activityId, organizationId },
        include: { assignedTo: { select: { email: true } }, createdBy: { select: { email: true } }, lead: { select: { phone: true } } },
      });
      // Sem atividade (já excluída de novo rapidinho?) ou já tem
      // externalId (já foi sincronizada antes — não chama de novo, ver
      // pushTaskUpdate) — nada a fazer.
      if (!activity || activity.externalId) return;

      const creds: LiroCredentials = { apiKey: this.cipher.decrypt(org.liroCrmApiKeyEncrypted), baseUrl: org.liroCrmBaseUrl };
      const input: UpsertLiroTaskInput = {
        externalId: activity.id,
        title: activity.title,
        dueDate: activity.dueDate?.toISOString() ?? null,
        done: Boolean(activity.doneAt),
        assignedUserEmail: activity.assignedTo?.email ?? null,
        createdByEmail: activity.createdBy?.email ?? null,
        contactPhoneNumber: activity.lead?.phone ?? null,
      };
      const resultado = await this.connector.upsertTask(creds, input);
      await this.prisma.activity.update({ where: { id: activity.id }, data: { externalId: resultado.id } });
    } catch (error) {
      this.logger.warn(`Não foi possível criar a tarefa ${activityId} no Liro CRM: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Melhor esforço, nunca lança: chamado depois de editar/concluir uma
   * tarefa aqui. Sem externalId ainda (a criação original nunca chegou a
   * sincronizar — integração conectada depois, ou falha na hora) tenta
   * criar agora em vez de desistir pra sempre.
   */
  async pushTaskUpdate(organizationId: string, activityId: string): Promise<void> {
    try {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org?.liroCrmApiKeyEncrypted || !org.liroCrmBaseUrl) return;

      const activity = await this.prisma.activity.findFirst({
        where: { id: activityId, organizationId },
        include: { assignedTo: { select: { email: true } }, lead: { select: { phone: true } } },
      });
      if (!activity) return;

      if (!activity.externalId) {
        await this.pushTaskCreate(organizationId, activityId);
        return;
      }

      const creds: LiroCredentials = { apiKey: this.cipher.decrypt(org.liroCrmApiKeyEncrypted), baseUrl: org.liroCrmBaseUrl };
      await this.connector.patchTask(creds, activity.externalId, {
        title: activity.title,
        dueDate: activity.dueDate?.toISOString() ?? null,
        done: Boolean(activity.doneAt),
        assignedUserEmail: activity.assignedTo?.email ?? null,
        contactPhoneNumber: activity.lead?.phone ?? null,
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.debug(`Tarefa ${activityId}: não encontrada mais no Liro CRM, nada a atualizar.`);
        return;
      }
      this.logger.warn(`Não foi possível atualizar a tarefa ${activityId} no Liro CRM: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Melhor esforço, nunca lança: chamado depois de excluir uma tarefa
   * aqui (ou em massa, "Limpar concluídas"). `externalId` nulo (nunca
   * chegou a sincronizar) já é tratado antes de chamar — nada a fazer.
   */
  async pushTaskDelete(organizationId: string, externalId: string | null): Promise<void> {
    if (!externalId) return;
    try {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org?.liroCrmApiKeyEncrypted || !org.liroCrmBaseUrl) return;

      const creds: LiroCredentials = { apiKey: this.cipher.decrypt(org.liroCrmApiKeyEncrypted), baseUrl: org.liroCrmBaseUrl };
      await this.connector.deleteTask(creds, externalId);
    } catch (error) {
      if (error instanceof NotFoundException) return; // já não existia lá — nada a fazer
      this.logger.warn(`Não foi possível excluir a tarefa (id ${externalId}) no Liro CRM: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Recebe (via handleInboundWebhook) os 4 eventos de tarefa vindos do
   * Liro. Escreve direto via Prisma, NUNCA por ActivitiesService — do
   * contrário disparia de volta um push pro Liro (pushTaskCreate/Update)
   * e viraria ping-pong infinito, mesmo motivo documentado no bloco de
   * funil acima. Upsert por externalId = id da Task no Liro (idempotente
   * — reentrega do Liro atualiza em vez de duplicar).
   */
  private async processTaskEvent(
    organizationId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const task = payload.task as
      | {
          id?: string;
          title?: string;
          dueDate?: string | null;
          done?: boolean;
          contact?: { phoneNumber?: string; name?: string } | null;
          assignedUserEmail?: string | null;
          createdByEmail?: string | null;
        }
      | undefined;
    if (!task?.id) {
      this.logger.warn(`Webhook do Liro CRM (org ${organizationId}, evento ${event}): sem "task.id" no payload — ignorado.`);
      return;
    }

    const existente = await this.prisma.activity.findFirst({ where: { organizationId, externalId: task.id } });

    if (event === 'task_deleted') {
      if (!existente) return; // nunca chegou a existir aqui (ou já foi excluída) — nada a fazer
      await this.prisma.activity.delete({ where: { id: existente.id } });
      return;
    }

    let assignedToId: string | undefined;
    if (task.assignedUserEmail) {
      const user = await this.prisma.user.findFirst({ where: { organizationId, email: task.assignedUserEmail } });
      assignedToId = user?.id;
    }
    // Activity.createdById não é opcional (toda atividade sempre tem
    // alguém que criou) — sem o e-mail de quem criou batendo com ninguém
    // aqui, cai pro responsável; sem nenhum dos dois, recusa em vez de
    // inventar um "criador" ou quebrar o insert.
    let createdById: string | undefined;
    if (task.createdByEmail) {
      const user = await this.prisma.user.findFirst({ where: { organizationId, email: task.createdByEmail } });
      createdById = user?.id;
    }
    createdById = createdById ?? assignedToId;
    if (!createdById) {
      this.logger.warn(
        `Webhook do Liro CRM (org ${organizationId}, evento ${event}, tarefa ${task.id}): nenhum usuário aqui com o e-mail de quem criou ou de quem é responsável — ignorado. Cadastre um usuário com esse e-mail na Aster.`,
      );
      return;
    }

    const phoneNormalizado = task.contact?.phoneNumber ? normalizePhone(task.contact.phoneNumber) : null;
    let leadId: string | undefined;
    if (phoneNormalizado) {
      const lead = await this.prisma.lead.findFirst({ where: { organizationId, OR: buildPhoneMatchConditions(undefined, phoneNormalizado) } });
      leadId = lead?.id;
    }

    // Preserva o doneAt original se a tarefa já estava concluída aqui e
    // continua concluída (senão toda edição não relacionada — ex: só
    // mudou o título — reataria a data de conclusão pra "agora").  Só
    // carimba data nova na transição de pendente -> concluída.
    const doneAt = !task.done ? null : (existente?.doneAt ?? new Date());

    const dados = {
      title: task.title ?? 'Tarefa sincronizada do Liro',
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
      doneAt,
      assignedToId: assignedToId ?? null,
      leadId: leadId ?? null,
    };

    await this.prisma.activity.upsert({
      where: { externalId: task.id },
      create: { ...dados, organizationId, createdById, type: 'TAREFA', origin: 'liro', externalId: task.id },
      update: dados,
    });
  }

  /**
   * Confere o header X-Liro-Signature (sha256=<hmac hex>) contra o corpo
   * bruto recebido. Tolerante de propósito — não derruba a integração de
   * quem já estava funcionando antes desse recurso existir: só bloqueia
   * quando existe segredo salvo E header presente E eles não batem (prova
   * de adulteração/forjadura). Sem segredo salvo ou sem header, deixa
   * passar com um aviso no log (ver saveCredentials — backfill acontece na
   * próxima reconexão/registro).
   */
  private verifyWebhookSignature(
    org: { id: string; liroWebhookSigningSecretEncrypted: string | null },
    rawBody: string | undefined,
    signatureHeader: string | undefined,
  ): boolean {
    if (!org.liroWebhookSigningSecretEncrypted) {
      this.logger.warn(`Webhook do Liro CRM (org ${org.id}): sem segredo salvo ainda — aceitando sem verificar assinatura.`);
      return true;
    }
    if (!signatureHeader) {
      this.logger.warn(`Webhook do Liro CRM (org ${org.id}): entrega sem header X-Liro-Signature — aceitando (Liro desatualizado?).`);
      return true;
    }
    if (rawBody === undefined) {
      this.logger.warn(`Webhook do Liro CRM (org ${org.id}): corpo bruto indisponível pra validar assinatura — aceitando.`);
      return true;
    }

    const secret = this.cipher.decrypt(org.liroWebhookSigningSecretEncrypted);
    const esperado = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    const recebido = Buffer.from(signatureHeader);
    const esperadoBuf = Buffer.from(esperado);
    const valido = recebido.length === esperadoBuf.length && timingSafeEqual(recebido, esperadoBuf);
    if (!valido) {
      this.logger.warn(`Webhook do Liro CRM (org ${org.id}): assinatura inválida — entrega rejeitada.`);
    }
    return valido;
  }

  /**
   * Recebe o aviso do Liro (POST /api/integrations/liro-crm/webhook/:token)
   * — hoje dois eventos: `conversation_moved` (card arrastado no Kanban de
   * lá) e `conversation_deleted` (atendimento excluído lá). Os dois
   * mexem no banco DIRETO, sem passar por DealsService.move()/remove(),
   * justamente pra não disparar de volta um push pro Liro e virar
   * ping-pong infinito entre os dois lados.
   */
  async handleInboundWebhook(
    token: string,
    payload: Record<string, unknown>,
    rawBody?: string,
    signatureHeader?: string,
  ): Promise<void> {
    const org = await this.prisma.organization.findFirst({ where: { liroWebhookToken: token } });
    if (!org) {
      this.logger.warn('Webhook do Liro CRM recebido com token desconhecido — ignorado.');
      return;
    }

    if (!this.verifyWebhookSignature(org, rawBody, signatureHeader)) {
      return;
    }

    // Inclui o token (== a organização) na chave, não só o corpo — dois
    // eventos de organizações diferentes byte-a-byte idênticos (mesmo
    // improvável) nunca devem se confundir num dedupe só.
    const hashEntrega = createHash('sha256').update(`${token}:${rawBody ?? JSON.stringify(payload)}`).digest('hex');
    if (jaProcessouEssaEntrega(hashEntrega)) {
      this.logger.warn(`Webhook do Liro CRM (org ${org.id}, evento ${payload.event}): entrega repetida (reentrega do Liro) — já processada, ignorando.`);
      return;
    }

    // Eventos de tarefa têm formato próprio (payload.task, não
    // payload.contact) — tratados à parte, ver processTaskEvent.
    if (typeof payload.event === 'string' && payload.event.startsWith('task_')) {
      await this.processTaskEvent(org.id, payload.event, payload);
      return;
    }

    const contact = payload.contact as { id?: string; phoneNumber?: string } | undefined;
    if (!contact) {
      this.logger.warn(`Webhook do Liro CRM (org ${org.id}, evento ${payload.event}) sem "contact" no payload — ignorado.`);
      return;
    }
    const phoneNormalizado = contact.phoneNumber ? normalizePhone(contact.phoneNumber) : null;

    // Busca TODOS os leads que batem (pode haver mais de um — dado legado
    // duplicado, ex.: um lead antigo criado manualmente com o negócio de
    // verdade, e outro criado depois pela sincronização com o telefone já
    // normalizado mas sem negócio nenhum) e escolhe o melhor candidato.
    // Prioridade nº 1 é ter um negócio ABERTO — de nada adianta achar um
    // lead "mais correto" que não tem nada pra mover; só entre os que TÊM
    // negócio (ou, se nenhum tiver, entre todos) é que desempata por id
    // vinculado do Liro, depois telefone exato, depois o primeiro.
    const candidatos = await this.prisma.lead.findMany({
      where: { organizationId: org.id, OR: buildPhoneMatchConditions(contact.id, phoneNormalizado) },
      include: { deals: { where: { status: 'ABERTO' }, select: { id: true }, take: 1 } },
    });
    const comNegocioAberto = candidatos.filter((l) => l.deals.length > 0);
    const pool = comNegocioAberto.length > 0 ? comNegocioAberto : candidatos;
    const lead =
      pool.find((l) => contact.id && l.liroContactId === contact.id) ??
      pool.find((l) => phoneNormalizado && l.phone === phoneNormalizado) ??
      pool[0];

    if (!lead) {
      this.logger.warn(
        `Webhook do Liro CRM (org ${org.id}, evento ${payload.event}): nenhum lead encontrado para contactId=${contact.id ?? '—'} phone=${phoneNormalizado ?? '—'} — ignorado.`,
      );
      return;
    }

    // Achou só pelo fallback de dígitos finais (ou por liroContactId, com
    // o telefone salvo desatualizado) — corrige o campo agora, assim os
    // próximos eventos já casam direto pelo telefone normalizado, sem
    // precisar do fallback de novo.
    if (phoneNormalizado && lead.phone !== phoneNormalizado) {
      await this.prisma.lead.update({ where: { id: lead.id }, data: { phone: phoneNormalizado } });
    }

    if (candidatos.length > 1) {
      this.logger.warn(
        `Webhook do Liro CRM (org ${org.id}): ${candidatos.length} leads bateram para contactId=${contact.id ?? '—'} phone=${phoneNormalizado ?? '—'} — usando o lead ${lead.id} (dado legado duplicado provável, considere revisar).`,
      );
    }

    if (payload.event === 'conversation_moved') {
      await this.moverNegocioParaEtapaMapeada(org.id, lead.id, payload);
    } else if (payload.event === 'conversation_deleted') {
      await this.removerDoFunilPorConversaExcluida(org.id, lead.id);
    }
  }

  private async moverNegocioParaEtapaMapeada(
    organizationId: string,
    leadId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const conversation = payload.conversation as { kanbanStage?: { id?: string; name?: string } } | undefined;
    const liroStageId = conversation?.kanbanStage?.id;
    if (!liroStageId) {
      this.logger.warn(`conversation_moved (org ${organizationId}, lead ${leadId}): payload sem conversation.kanbanStage.id — ignorado.`);
      return;
    }

    const deal = await this.prisma.deal.findFirst({
      where: { organizationId, leadId, status: 'ABERTO' },
      orderBy: { updatedAt: 'desc' },
      include: { pipeline: true },
    });
    if (!deal) {
      this.logger.warn(`conversation_moved (org ${organizationId}, lead ${leadId}): lead não tem negócio ABERTO no funil — nada pra mover.`);
      return;
    }

    const etapaAlvo = await this.prisma.pipelineStage.findFirst({
      where: { pipelineId: deal.pipelineId, liroKanbanStageId: liroStageId },
    });
    if (!etapaAlvo) {
      this.logger.warn(
        `conversation_moved (org ${organizationId}, deal ${deal.id}): etapa do Liro "${conversation?.kanbanStage?.name ?? liroStageId}" (id ${liroStageId}) não está mapeada pra nenhuma etapa do pipeline ${deal.pipelineId} — configure em Configurações > Integrações > Liro CRM.`,
      );
      return;
    }
    if (etapaAlvo.id === deal.stageId) return; // já está lá — nada a fazer, não é erro

    await this.prisma.deal.update({ where: { id: deal.id }, data: { stageId: etapaAlvo.id } });
    await this.auditService.log({
      organizationId,
      // Sem userId: veio de fora, não de uma ação de alguém logado.
      userId: undefined,
      action: 'LIRO_CRM_STAGE_SYNCED_FROM_LIRO',
      entityType: 'Deal',
      entityId: deal.id,
      metadata: { liroKanbanStageId: liroStageId, newStageId: etapaAlvo.id } as Prisma.InputJsonValue,
    });
    // Avisa quem está com o Funil de Vendas aberto AGORA (SSE) — sem isso,
    // uma mudança de etapa vinda do Liro só aparecia na tela quando o
    // polling batesse de novo (era exatamente esse atraso que dava a
    // impressão de "sync não funciona" quando na verdade só demorava).
    this.realtimeService.publish(organizationId, 'deal-changed', { dealId: deal.id, reason: 'liro-stage-synced' });
  }

  /**
   * Atendimento excluído no Liro → o negócio some do Funil de Vendas
   * (registro apagado), mas o Lead continua existindo normalmente na aba
   * Leads — a pessoa pode recolocá-lo no funil quando quiser, pelo botão
   * "Adicionar ao Funil de Vendas" no detalhe do lead.
   */
  private async removerDoFunilPorConversaExcluida(organizationId: string, leadId: string): Promise<void> {
    const deals = await this.prisma.deal.findMany({ where: { organizationId, leadId, status: 'ABERTO' } });
    if (deals.length === 0) return;

    await this.prisma.deal.deleteMany({ where: { id: { in: deals.map((d) => d.id) } } });
    await this.auditService.log({
      organizationId,
      userId: undefined,
      action: 'LIRO_CRM_DEAL_REMOVED_FROM_FUNNEL',
      entityType: 'Lead',
      entityId: leadId,
      metadata: { dealIds: deals.map((d) => d.id) } as Prisma.InputJsonValue,
    });
    this.realtimeService.publish(organizationId, 'deal-changed', { reason: 'liro-conversation-deleted', dealIds: deals.map((d) => d.id) });
  }

  /**
   * "Adicionar ao Funil de Vendas" manual — mesma lógica de criação de
   * negócio na 1ª etapa que o syncContacts já faz sozinho pra lead novo,
   * só que sob demanda: pra um lead que nunca teve negócio, ou que saiu
   * do funil (ex.: conversa excluída no Liro) e a pessoa quer colocar de
   * volta quando quiser. Não deixa duplicar: se já tiver negócio ABERTO,
   * é isso que devolve.
   */
  async addLeadToFunnel(organizationId: string, userId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) {
      throw new NotFoundException('Lead não encontrado.');
    }

    const existente = await this.prisma.deal.findFirst({ where: { organizationId, leadId, status: 'ABERTO' } });
    if (existente) return existente;

    const primeiraEtapa = await this.prisma.pipelineStage.findFirst({
      where: { pipeline: { organizationId } },
      orderBy: [{ pipeline: { isDefault: 'desc' } }, { order: 'asc' }],
    });
    if (!primeiraEtapa) {
      throw new BadRequestException('Esta organização ainda não tem nenhum funil configurado.');
    }

    const deal = await this.prisma.deal.create({
      data: {
        organizationId,
        leadId: lead.id,
        pipelineId: primeiraEtapa.pipelineId,
        stageId: primeiraEtapa.id,
        title: lead.name,
        ownerId: userId,
      },
    });

    // Mesmo motivo do DealsService.create() — o negócio já nasce numa
    // etapa, reflete no Liro desde já se ela tiver mapeamento.
    this.pushStageForDeal(organizationId, deal.id).catch(() => {});

    return deal;
  }
}
