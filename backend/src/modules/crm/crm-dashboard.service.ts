import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CrmDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string) {
    const [openDeals, wonDeals, lostDeals, byStage] = await Promise.all([
      this.prisma.deal.aggregate({
        where: { organizationId, status: 'ABERTO' },
        _count: true,
        _sum: { value: true },
      }),
      this.prisma.deal.aggregate({
        where: { organizationId, status: 'GANHO' },
        _count: true,
        _sum: { value: true },
      }),
      this.prisma.deal.aggregate({
        where: { organizationId, status: 'PERDIDO' },
        _count: true,
        _sum: { value: true },
      }),
      this.prisma.deal.groupBy({
        by: ['stageId'],
        where: { organizationId, status: 'ABERTO' },
        _count: true,
        _sum: { value: true },
      }),
    ]);

    const stages = await this.prisma.pipelineStage.findMany({
      where: { pipeline: { organizationId } },
      orderBy: { order: 'asc' },
    });

    const funnel = stages.map((stage) => {
      const match = byStage.find((row) => row.stageId === stage.id);
      return {
        stageId: stage.id,
        stageName: stage.name,
        colorHex: stage.colorHex,
        count: match?._count ?? 0,
        totalValue: Number(match?._sum.value ?? 0),
      };
    });

    const totalClosed = (wonDeals._count ?? 0) + (lostDeals._count ?? 0);
    const conversionRate = totalClosed > 0 ? (wonDeals._count ?? 0) / totalClosed : 0;

    return {
      open: { count: openDeals._count, totalValue: Number(openDeals._sum.value ?? 0) },
      won: { count: wonDeals._count, totalValue: Number(wonDeals._sum.value ?? 0) },
      lost: { count: lostDeals._count, totalValue: Number(lostDeals._sum.value ?? 0) },
      conversionRate,
      funnel,
    };
  }

  async teamPerformance(organizationId: string) {
    const owners = await this.prisma.user.findMany({
      where: { organizationId, active: true },
      select: { id: true, name: true, role: true },
    });

    const performance = await Promise.all(
      owners.map(async (owner) => {
        const [won, open, activitiesDone, activitiesPending] = await Promise.all([
          this.prisma.deal.aggregate({
            where: { organizationId, ownerId: owner.id, status: 'GANHO' },
            _count: true,
            _sum: { value: true },
          }),
          this.prisma.deal.aggregate({
            where: { organizationId, ownerId: owner.id, status: 'ABERTO' },
            _count: true,
            _sum: { value: true },
          }),
          this.prisma.activity.count({
            where: { organizationId, assignedToId: owner.id, doneAt: { not: null } },
          }),
          this.prisma.activity.count({
            where: { organizationId, assignedToId: owner.id, doneAt: null },
          }),
        ]);

        return {
          userId: owner.id,
          name: owner.name,
          role: owner.role,
          dealsWon: won._count,
          revenueWon: Number(won._sum.value ?? 0),
          openDeals: open._count,
          openPipelineValue: Number(open._sum.value ?? 0),
          activitiesDone,
          activitiesPending,
        };
      }),
    );

    return performance
      .filter((row) => ['VENDEDOR', 'GESTOR', 'ADMIN'].includes(row.role))
      .sort((a, b) => b.revenueWon - a.revenueWon);
  }
}
