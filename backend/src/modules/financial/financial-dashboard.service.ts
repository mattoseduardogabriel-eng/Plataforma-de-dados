import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FinancialDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async cashFlow(organizationId: string, months = 6) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        organizationId,
        status: { not: 'CANCELADO' },
        dueDate: { gte: start },
      },
      select: { type: true, amount: true, dueDate: true, status: true },
    });

    const buckets: Record<string, { month: string; receitas: number; despesas: number }> = {};
    for (let i = 0; i < months; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = { month: key, receitas: 0, despesas: 0 };
    }

    for (const tx of transactions) {
      const d = new Date(tx.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets[key]) continue;
      if (tx.type === 'RECEITA') {
        buckets[key].receitas += Number(tx.amount);
      } else {
        buckets[key].despesas += Number(tx.amount);
      }
    }

    const series = Object.values(buckets).map((b) => ({
      ...b,
      saldo: b.receitas - b.despesas,
    }));

    const [pendingReceivables, overdue, paidThisMonth] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { organizationId, type: 'RECEITA', status: 'PENDENTE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.transaction.count({
        where: { organizationId, status: { in: ['PENDENTE', 'ATRASADO'] }, dueDate: { lt: now } },
      }),
      this.prisma.transaction.aggregate({
        where: {
          organizationId,
          status: 'PAGO',
          paidAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      series,
      summary: {
        pendingReceivablesTotal: Number(pendingReceivables._sum.amount ?? 0),
        pendingReceivablesCount: pendingReceivables._count,
        overdueCount: overdue,
        paidThisMonthTotal: Number(paidThisMonth._sum.amount ?? 0),
      },
    };
  }
}
