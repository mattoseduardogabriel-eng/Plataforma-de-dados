import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface AuditLogInput {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  purpose?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/**
 * Registro de auditoria — base da conformidade LGPD da plataforma.
 * Toda ação sensível (login, consulta de dado pessoal, alteração de
 * cadastro) deve ser registrada aqui: quem fez, o quê, quando e — no caso
 * de consultas de dado pessoal — com qual finalidade.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        purpose: input.purpose ?? null,
        metadata: input.metadata,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async findForOrganization(
    organizationId: string,
    filters: { entityType?: string; userId?: string; from?: Date; to?: Date },
    pagination: { skip?: number; take?: number },
  ) {
    const where: Prisma.AuditLogWhereInput = {
      organizationId,
      entityType: filters.entityType,
      userId: filters.userId,
      createdAt: {
        gte: filters.from,
        lte: filters.to,
      },
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip ?? 0,
        take: pagination.take ?? 50,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
