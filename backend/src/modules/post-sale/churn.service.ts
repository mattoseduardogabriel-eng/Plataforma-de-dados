import { Injectable, NotFoundException } from '@nestjs/common';
import { ChurnRiskLevel } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateChurnSignalDto } from './dto/create-churn-signal.dto';

const SIGNAL_WINDOW_DAYS = 90;

@Injectable()
export class ChurnService {
  constructor(private readonly prisma: PrismaService) {}

  async recordSignal(organizationId: string, dto: CreateChurnSignalDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, organizationId },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }

    await this.prisma.churnSignal.create({
      data: {
        organizationId,
        customerId: dto.customerId,
        signalType: dto.signalType,
        weight: dto.weight ?? 1,
        notes: dto.notes,
      },
    });

    return this.recalculateRisk(organizationId, dto.customerId);
  }

  async recalculateRisk(organizationId: string, customerId: string) {
    const since = new Date();
    since.setDate(since.getDate() - SIGNAL_WINDOW_DAYS);

    const signals = await this.prisma.churnSignal.findMany({
      where: { organizationId, customerId, createdAt: { gte: since } },
    });

    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const score = Math.min(100, totalWeight * 10);
    const level: ChurnRiskLevel = score >= 60 ? 'ALTO' : score >= 25 ? 'MEDIO' : 'BAIXO';

    return this.prisma.customer.update({
      where: { id: customerId },
      data: { churnRiskScore: score, churnRiskLevel: level },
    });
  }

  async portfolioOverview(organizationId: string) {
    const [byStatus, byRisk, totalMonthlyValue] = await Promise.all([
      this.prisma.customer.groupBy({ by: ['status'], where: { organizationId }, _count: true }),
      this.prisma.customer.groupBy({
        by: ['churnRiskLevel'],
        where: { organizationId, status: 'ATIVO' },
        _count: true,
      }),
      this.prisma.customer.aggregate({
        where: { organizationId, status: 'ATIVO' },
        _sum: { monthlyValue: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
      byRisk: byRisk.map((r) => ({ level: r.churnRiskLevel ?? 'SEM_DADOS', count: r._count })),
      monthlyRecurringRevenue: Number(totalMonthlyValue._sum.monthlyValue ?? 0),
    };
  }
}
