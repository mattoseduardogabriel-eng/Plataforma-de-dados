import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SecretCipher } from '../../../common/crypto/secret-cipher';
import { AuditService } from '../../audit/audit.service';
import { DataProviderResult } from '../../data-intelligence/connectors/data-provider.interface';
import {
  PersonalDataProviderConnector,
  PersonalDataProviderCredentials,
  PersonalDataQueryKind,
} from './personal-data-provider.connector';
import { SavePersonalDataProviderConfigDto } from './dto/save-config.dto';

const PATH_FIELD_BY_KIND: Record<PersonalDataQueryKind, 'cpfPath' | 'phonePath' | 'creditScorePath' | 'relativesPath'> = {
  cpf: 'cpfPath',
  phone: 'phonePath',
  creditScore: 'creditScorePath',
  relatives: 'relativesPath',
};

@Injectable()
export class PersonalDataProviderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
    private readonly connector: PersonalDataProviderConnector,
    private readonly auditService: AuditService,
  ) {}

  async status(organizationId: string) {
    const config = await this.prisma.personalDataProviderConfig.findUnique({ where: { organizationId } });
    if (!config) return { configured: false as const };
    return {
      configured: true as const,
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKeySuffix: SecretCipher.maskSuffix(this.cipher.decrypt(config.apiKeyEncrypted)),
      cpfConfigured: !!config.cpfPath,
      phoneConfigured: !!config.phonePath,
      creditScoreConfigured: !!config.creditScorePath,
      relativesConfigured: !!config.relativesPath,
      updatedAt: config.updatedAt,
    };
  }

  async saveConfig(organizationId: string, userId: string, dto: SavePersonalDataProviderConfigDto) {
    if (!dto.cpfPath && !dto.phonePath && !dto.creditScorePath && !dto.relativesPath) {
      throw new BadRequestException(
        'Configure ao menos um caminho de consulta (CPF, telefone, score ou parentes) — sem isso, nenhuma consulta real seria feita.',
      );
    }

    await this.prisma.personalDataProviderConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        provider: dto.provider,
        baseUrl: dto.baseUrl,
        apiKeyEncrypted: this.cipher.encrypt(dto.apiKey),
        authHeaderName: dto.authHeaderName ?? 'Authorization',
        authScheme: dto.authScheme ?? 'Bearer',
        cpfPath: dto.cpfPath,
        phonePath: dto.phonePath,
        creditScorePath: dto.creditScorePath,
        relativesPath: dto.relativesPath,
      },
      update: {
        provider: dto.provider,
        baseUrl: dto.baseUrl,
        apiKeyEncrypted: this.cipher.encrypt(dto.apiKey),
        authHeaderName: dto.authHeaderName ?? 'Authorization',
        authScheme: dto.authScheme ?? 'Bearer',
        cpfPath: dto.cpfPath ?? null,
        phonePath: dto.phonePath ?? null,
        creditScorePath: dto.creditScorePath ?? null,
        relativesPath: dto.relativesPath ?? null,
      },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'PERSONAL_DATA_PROVIDER_CONFIG_SAVED',
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { provider: dto.provider, baseUrl: dto.baseUrl },
    });

    return this.status(organizationId);
  }

  async removeConfig(organizationId: string, userId: string) {
    await this.prisma.personalDataProviderConfig.deleteMany({ where: { organizationId } });
    await this.auditService.log({
      organizationId,
      userId,
      action: 'PERSONAL_DATA_PROVIDER_CONFIG_REMOVED',
      entityType: 'Organization',
      entityId: organizationId,
    });
    return { configured: false as const };
  }

  /**
   * Testa a credencial chamando de verdade o primeiro caminho configurado,
   * com um documento de teste (00000000000) — mesmo princípio do "salvar só
   * depois de validar" usado na integração com o Liro CRM.
   */
  async testConnection(organizationId: string) {
    const config = await this.prisma.personalDataProviderConfig.findUnique({ where: { organizationId } });
    if (!config) {
      throw new BadRequestException('Nenhum provedor de dados pessoais configurado para esta organização.');
    }
    const [kind, path] = (Object.entries(PATH_FIELD_BY_KIND) as [PersonalDataQueryKind, keyof typeof config][])
      .map(([k, field]) => [k, config[field] as string | null] as const)
      .find(([, value]) => !!value) ?? [];

    if (!kind || !path) {
      throw new BadRequestException('Nenhum caminho de consulta configurado para testar.');
    }

    const creds = this.toCredentials(config);
    await this.connector.query(creds, path, '00000000000');
    return { success: true, testedKind: kind };
  }

  /**
   * Ponto de entrada usado pelo DataIntelligenceService: retorna `null`
   * quando a organização não configurou provedor real para este tipo de
   * consulta (o caller deve então cair no conector mock).
   */
  async resolveQuery(
    organizationId: string,
    kind: PersonalDataQueryKind,
    documento: string,
  ): Promise<DataProviderResult<Record<string, unknown>> | null> {
    const config = await this.prisma.personalDataProviderConfig.findUnique({ where: { organizationId } });
    const path = config?.[PATH_FIELD_BY_KIND[kind]] as string | null | undefined;
    if (!config || !path) return null;

    return this.connector.query(this.toCredentials(config), path, documento);
  }

  private toCredentials(config: {
    provider: string;
    baseUrl: string;
    apiKeyEncrypted: string;
    authHeaderName: string;
    authScheme: string;
  }): PersonalDataProviderCredentials {
    return {
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKey: this.cipher.decrypt(config.apiKeyEncrypted),
      authHeaderName: config.authHeaderName,
      authScheme: config.authScheme,
    };
  }
}
