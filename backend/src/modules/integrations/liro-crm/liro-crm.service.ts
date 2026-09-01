import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DocumentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SecretCipher } from '../../../common/crypto/secret-cipher';
import { AuditService } from '../../audit/audit.service';
import { LiroCrmConnector, LiroCredentials } from './liro-crm.connector';
import { SaveLiroCrmCredentialsDto } from './dto/save-credentials.dto';
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

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        liroCrmApiKeyEncrypted: this.cipher.encrypt(dto.apiKey),
        liroCrmBaseUrl: dto.baseUrl,
      },
    });

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
      data: { liroCrmApiKeyEncrypted: null, liroCrmBaseUrl: null, liroCrmLastSyncedAt: null },
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

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { liroCrmLastSyncedAt: new Date() },
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
}
