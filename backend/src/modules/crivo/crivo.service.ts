import { Injectable } from '@nestjs/common';
import { CrivoOutcome, Prisma, ReportTargetType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CnpjConnector } from '../data-intelligence/connectors/cnpj.connector';
import { CreditScoreConnector } from '../data-intelligence/connectors/credit-score.connector';
import { PoliciesService } from './policies.service';
import { EvaluateCrivoDto } from './dto/evaluate-crivo.dto';

interface CrivoReason {
  criterio: string;
  resultado: 'OK' | 'ALERTA' | 'BLOQUEIO';
  detalhe: string;
}

@Injectable()
export class CrivoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cnpjConnector: CnpjConnector,
    private readonly creditScoreConnector: CreditScoreConnector,
    private readonly policiesService: PoliciesService,
  ) {}

  async evaluate(organizationId: string, userId: string, dto: EvaluateCrivoDto) {
    const document = dto.document.replace(/\D/g, '');
    const policy = dto.policyId
      ? await this.policiesService.findOne(organizationId, dto.policyId)
      : await this.policiesService.findDefault(organizationId);

    const reasons: CrivoReason[] = [];
    let hasBlock = false;
    let hasAlert = false;

    // 1) Situação cadastral (apenas CNPJ) — dado oficial real via BrasilAPI
    if (dto.targetType === ReportTargetType.CNPJ) {
      try {
        const { data: cnpjData } = await this.cnpjConnector.query(document);
        const ativa = cnpjData.situacaoCadastral?.toUpperCase() === 'ATIVA';
        if (!ativa && policy.blockIfCnpjInativa) {
          hasBlock = true;
          reasons.push({
            criterio: 'Situação cadastral do CNPJ',
            resultado: 'BLOQUEIO',
            detalhe: `Situação atual: ${cnpjData.situacaoCadastral}. Política exige CNPJ ativo.`,
          });
        } else {
          reasons.push({
            criterio: 'Situação cadastral do CNPJ',
            resultado: ativa ? 'OK' : 'ALERTA',
            detalhe: `Situação atual: ${cnpjData.situacaoCadastral}.`,
          });
        }
      } catch {
        hasAlert = true;
        reasons.push({
          criterio: 'Situação cadastral do CNPJ',
          resultado: 'ALERTA',
          detalhe: 'Não foi possível confirmar a situação cadastral na Receita Federal no momento.',
        });
      }
    }

    // 2) Score de crédito (mock/demo — conector plugável)
    const { data: scoreData, isDemoData } = await this.creditScoreConnector.query(document);
    reasons.push({
      criterio: 'Score de crédito',
      resultado:
        scoreData.scoreSimulado >= policy.minScoreApproved
          ? 'OK'
          : scoreData.scoreSimulado >= policy.minScoreManualReview
            ? 'ALERTA'
            : 'BLOQUEIO',
      detalhe: `Score simulado: ${scoreData.scoreSimulado}/1000 (${scoreData.faixaSimulada}).${isDemoData ? ' [dado de demonstração]' : ''}`,
    });

    // 3) Pendências
    if (scoreData.pendenciasSimuladas > policy.maxPendenciasAllowed) {
      hasBlock = true;
      reasons.push({
        criterio: 'Pendências financeiras',
        resultado: 'BLOQUEIO',
        detalhe: `${scoreData.pendenciasSimuladas} pendência(s) simulada(s) — acima do limite (${policy.maxPendenciasAllowed}).`,
      });
    } else {
      reasons.push({
        criterio: 'Pendências financeiras',
        resultado: 'OK',
        detalhe: `${scoreData.pendenciasSimuladas} pendência(s) — dentro do limite.`,
      });
    }

    // 4) Risco de churn, se já for cliente da carteira (cruzamento com Pós-venda)
    if (policy.flagIfChurnRiskAlto) {
      const existingCustomer = await this.prisma.customer.findFirst({
        where: { organizationId, document },
      });
      if (existingCustomer?.churnRiskLevel === 'ALTO') {
        hasAlert = true;
        reasons.push({
          criterio: 'Risco de cancelamento (carteira atual)',
          resultado: 'ALERTA',
          detalhe: 'Cliente já ativo na base com risco de churn ALTO — recomenda-se análise manual.',
        });
      }
    }

    // Decisão final
    let outcome: CrivoOutcome;
    if (hasBlock) {
      outcome = CrivoOutcome.REPROVADO;
    } else if (hasAlert || scoreData.scoreSimulado < policy.minScoreApproved) {
      outcome = CrivoOutcome.ANALISE_MANUAL;
    } else {
      outcome = CrivoOutcome.APROVADO;
    }

    const suggestedCreditLimit =
      outcome === CrivoOutcome.REPROVADO
        ? 0
        : Math.min(
            Number(policy.maxCreditLimit),
            Math.round(scoreData.scoreSimulado * Number(policy.creditLimitPerScorePoint)),
          );

    const decision = await this.prisma.crivoDecision.create({
      data: {
        organizationId,
        policyId: policy.id,
        targetDocument: document,
        targetType: dto.targetType,
        outcome,
        scoreUsed: scoreData.scoreSimulado,
        suggestedCreditLimit,
        reasons: reasons as unknown as Prisma.InputJsonValue,
        purpose: dto.purpose,
        requestedById: userId,
      },
      include: { policy: true },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CRIVO_DECISION',
      entityType: 'CrivoDecision',
      entityId: decision.id,
      purpose: dto.purpose,
      metadata: { targetDocument: document, outcome } as Prisma.InputJsonValue,
    });

    return decision;
  }

  findAll(organizationId: string, targetDocument?: string) {
    return this.prisma.crivoDecision.findMany({
      where: { organizationId, targetDocument: targetDocument?.replace(/\D/g, '') },
      include: { policy: { select: { id: true, name: true } }, requestedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
