import { Injectable } from '@nestjs/common';
import { DataQueryType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CnpjConnector } from './connectors/cnpj.connector';
import { CpfConnector } from './connectors/cpf.connector';
import { PhoneConnector } from './connectors/phone.connector';
import { CreditScoreConnector } from './connectors/credit-score.connector';
import { RelativesConnector } from './connectors/relatives.connector';
import { DataProviderResult } from './connectors/data-provider.interface';

const CNPJ_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — dado público, mas evita martelar a API externa

export interface RunQueryOptions {
  organizationId: string;
  userId: string;
  type: DataQueryType;
  target: string;
  purpose: string;
  ipAddress?: string;
}

@Injectable()
export class DataIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cnpjConnector: CnpjConnector,
    private readonly cpfConnector: CpfConnector,
    private readonly phoneConnector: PhoneConnector,
    private readonly creditScoreConnector: CreditScoreConnector,
    private readonly relativesConnector: RelativesConnector,
  ) {}

  async queryCnpj(opts: Omit<RunQueryOptions, 'type'>) {
    const cleanTarget = opts.target.replace(/\D/g, '');
    const cached = await this.prisma.dataQuery.findFirst({
      where: {
        organizationId: opts.organizationId,
        type: 'CNPJ',
        targetDocument: cleanTarget,
        createdAt: { gte: new Date(Date.now() - CNPJ_CACHE_TTL_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (cached) {
      await this.persist({ ...opts, type: 'CNPJ' }, {
        provider: `${cached.provider}-cache`,
        isDemoData: cached.isDemoData,
        data: cached.resultJson,
      });
      return { provider: `${cached.provider}-cache`, isDemoData: cached.isDemoData, data: cached.resultJson };
    }

    const result = await this.cnpjConnector.query(cleanTarget);
    await this.persist({ ...opts, type: 'CNPJ' }, result);
    return result;
  }

  async queryCpf(opts: Omit<RunQueryOptions, 'type'>) {
    const result = await this.cpfConnector.query(opts.target);
    await this.persist({ ...opts, type: 'CPF' }, result);
    return result;
  }

  async queryPhone(opts: Omit<RunQueryOptions, 'type'>) {
    const result = await this.phoneConnector.query(opts.target);
    await this.persist({ ...opts, type: 'TELEFONE' }, result);
    return result;
  }

  async queryCreditScore(opts: Omit<RunQueryOptions, 'type'>) {
    const result = await this.creditScoreConnector.query(opts.target);
    await this.persist({ ...opts, type: 'CREDITO' }, result);
    return result;
  }

  async queryRelatives(opts: Omit<RunQueryOptions, 'type'>) {
    const result = await this.relativesConnector.query(opts.target);
    await this.persist({ ...opts, type: 'PARENTES' }, result);
    return result;
  }

  private async persist(opts: RunQueryOptions, result: DataProviderResult<any>) {
    const cleanTarget = opts.target.replace(/\D/g, '');
    await this.prisma.dataQuery.create({
      data: {
        organizationId: opts.organizationId,
        requestedById: opts.userId,
        type: opts.type,
        targetDocument: cleanTarget,
        purpose: opts.purpose,
        provider: result.provider,
        isDemoData: result.isDemoData,
        resultJson: result.data as Prisma.InputJsonValue,
      },
    });

    await this.auditService.log({
      organizationId: opts.organizationId,
      userId: opts.userId,
      action: `DATA_QUERY_${opts.type}`,
      entityType: 'DataQuery',
      entityId: cleanTarget,
      purpose: opts.purpose,
      ipAddress: opts.ipAddress,
      metadata: { provider: result.provider, isDemoData: result.isDemoData } as Prisma.InputJsonValue,
    });
  }

  async history(
    organizationId: string,
    filters: { type?: DataQueryType; targetDocument?: string },
    pagination: { skip?: number; take?: number },
  ) {
    const where: Prisma.DataQueryWhereInput = {
      organizationId,
      type: filters.type,
      targetDocument: filters.targetDocument?.replace(/\D/g, ''),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dataQuery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip ?? 0,
        take: pagination.take ?? 50,
        include: { requestedBy: { select: { id: true, name: true } } },
      }),
      this.prisma.dataQuery.count({ where }),
    ]);
    return { items, total };
  }
}
