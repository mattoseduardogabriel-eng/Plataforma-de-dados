import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id } });
    if (!organization) {
      throw new NotFoundException('Organização não encontrada.');
    }
    return organization;
  }

  async update(id: string, data: { name?: string; cnpj?: string }) {
    await this.findOne(id);
    return this.prisma.organization.update({ where: { id }, data });
  }

  /**
   * O ADMIN da empresa confirma/assina o plano definido pelo dono da
   * plataforma — só registra o aceite (sem gateway de pagamento
   * integrado, não muda o status da assinatura, que é controlado no
   * backoffice).
   */
  async confirmSubscription(id: string, userId: string) {
    const organization = await this.findOne(id);
    if (!organization.subscriptionPlan) {
      throw new BadRequestException('Ainda não há um plano definido pra confirmar. Fale com o suporte.');
    }
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { subscriptionConfirmedAt: new Date() },
    });
    await this.auditService.log({
      organizationId: id,
      userId,
      action: 'SUBSCRIPTION_CONFIRMED',
      entityType: 'Organization',
      entityId: id,
      metadata: { subscriptionPlan: organization.subscriptionPlan, subscriptionPriceCents: organization.subscriptionPriceCents },
    });
    return updated;
  }
}
