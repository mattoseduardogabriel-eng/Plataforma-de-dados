import { Injectable, NotFoundException } from '@nestjs/common';
import { Parser } from 'json2csv';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CnpjConnector } from '../data-intelligence/connectors/cnpj.connector';
import { CpfConnector } from '../data-intelligence/connectors/cpf.connector';
import { CreditScoreConnector } from '../data-intelligence/connectors/credit-score.connector';
import { RelativesConnector } from '../data-intelligence/connectors/relatives.connector';
import { GenerateReportDto } from './dto/generate-report.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cnpjConnector: CnpjConnector,
    private readonly cpfConnector: CpfConnector,
    private readonly creditScoreConnector: CreditScoreConnector,
    private readonly relativesConnector: RelativesConnector,
  ) {}

  async generate(organizationId: string, userId: string, dto: GenerateReportDto) {
    const cleanDocument = dto.targetDocument.replace(/\D/g, '');

    const [internal, external] = await Promise.all([
      this.collectInternalData(organizationId, cleanDocument),
      this.collectExternalData(dto.targetType, cleanDocument),
    ]);

    const summary = {
      targetDocument: cleanDocument,
      targetType: dto.targetType,
      generatedAt: new Date().toISOString(),
      internal,
      external,
    };

    const report = await this.prisma.report.create({
      data: {
        organizationId,
        title: dto.title ?? `Cruzamento — ${cleanDocument}`,
        targetDocument: cleanDocument,
        targetType: dto.targetType,
        summaryJson: summary as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CROSS_REFERENCE_REPORT',
      entityType: 'Report',
      entityId: report.id,
      purpose: dto.purpose,
      metadata: { targetDocument: cleanDocument, targetType: dto.targetType } as Prisma.InputJsonValue,
    });

    return report;
  }

  private async collectInternalData(organizationId: string, document: string) {
    const [leads, customers] = await Promise.all([
      this.prisma.lead.findMany({
        where: { organizationId, document },
        include: { deals: { include: { stage: true } } },
      }),
      this.prisma.customer.findMany({
        where: { organizationId, document },
        include: { contracts: true, churnSignals: true },
      }),
    ]);

    const customerIds = customers.map((c) => c.id);
    const transactions = customerIds.length
      ? await this.prisma.transaction.findMany({
          where: { organizationId, customerId: { in: customerIds } },
          orderBy: { dueDate: 'desc' },
          take: 20,
        })
      : [];

    return { leads, customers, transactions };
  }

  private async collectExternalData(targetType: 'CNPJ' | 'CPF', document: string) {
    if (targetType === 'CNPJ') {
      const cnpj = await this.safeCall(() => this.cnpjConnector.query(document));
      return { cnpj };
    }
    const [cpf, creditScore, relatives] = await Promise.all([
      this.safeCall(() => this.cpfConnector.query(document)),
      this.safeCall(() => this.creditScoreConnector.query(document)),
      this.safeCall(() => this.relativesConnector.query(document)),
    ]);
    return { cpf, creditScore, relatives };
  }

  private async safeCall<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
    try {
      return await fn();
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Falha ao consultar conector.' };
    }
  }

  findAll(organizationId: string) {
    return this.prisma.report.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }

  async findOne(organizationId: string, id: string) {
    const report = await this.prisma.report.findFirst({ where: { id, organizationId } });
    if (!report) {
      throw new NotFoundException('Relatório não encontrado.');
    }
    return report;
  }

  async exportCsv(organizationId: string, id: string): Promise<string> {
    const report = await this.findOne(organizationId, id);
    const summary = report.summaryJson as any;
    const rows: Record<string, unknown>[] = [];

    rows.push({ secao: 'Cabeçalho', chave: 'Documento', valor: summary.targetDocument });
    rows.push({ secao: 'Cabeçalho', chave: 'Tipo', valor: summary.targetType });
    rows.push({ secao: 'Cabeçalho', chave: 'Gerado em', valor: summary.generatedAt });

    const flatten = (secao: string, obj: unknown, prefix = '') => {
      if (obj === null || obj === undefined) return;
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => flatten(secao, item, `${prefix}${idx}.`));
        return;
      }
      if (typeof obj === 'object') {
        Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
          if (value !== null && typeof value === 'object') {
            flatten(secao, value, `${prefix}${key}.`);
          } else {
            rows.push({ secao, chave: `${prefix}${key}`, valor: value as any });
          }
        });
        return;
      }
      rows.push({ secao, chave: prefix.replace(/\.$/, ''), valor: obj as any });
    };

    flatten('Interno', summary.internal);
    flatten('Externo', summary.external);

    const parser = new Parser({ fields: ['secao', 'chave', 'valor'] });
    return parser.parse(rows);
  }
}
