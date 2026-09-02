import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

const SALT_ROUNDS = 10;
const DEFAULT_TRIAL_DAYS = 14;

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

@Injectable()
export class BackofficeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Lista todas as empresas clientes (nunca inclui a organização técnica da plataforma). */
  async listOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      where: { isPlatform: false },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true, leads: true, customers: true, deals: true },
        },
      },
    });
    return organizations.map(({ _count, ...org }) => ({ ...org, counts: _count }));
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, isPlatform: false },
      include: {
        users: {
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { leads: true, customers: true, deals: true, transactions: true } },
      },
    });
    if (!org) {
      throw new NotFoundException('Empresa não encontrada.');
    }
    return org;
  }

  /** Cria uma nova empresa cliente com seu primeiro usuário ADMIN, pronta pra uso (funil + política de crédito padrão). */
  async createOrganization(dto: CreateOrganizationDto, actorUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, SALT_ROUNDS);

    const trialDays = dto.trialDays ?? DEFAULT_TRIAL_DAYS;

    const organization = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
          cnpj: dto.organizationCnpj,
          // Criada direto pelo backoffice = já aprovada pelo dono da plataforma.
          approvalStatus: 'APPROVED',
          approvedAt: new Date(),
          subscriptionStatus: 'TRIAL',
          trialEndsAt: trialDays > 0 ? daysFromNow(trialDays) : null,
        },
      });
      await tx.user.create({
        data: {
          organizationId: organization.id,
          name: dto.adminName,
          email: dto.adminEmail,
          passwordHash,
          role: Role.ADMIN,
        },
      });
      await tx.pipeline.create({
        data: {
          organizationId: organization.id,
          name: 'Funil de Vendas',
          isDefault: true,
          stages: {
            create: [
              { name: 'Novo Contato', order: 1, colorHex: '#94a3b8' },
              { name: 'Qualificação', order: 2, colorHex: '#38bdf8' },
              { name: 'Proposta Enviada', order: 3, colorHex: '#a78bfa' },
              { name: 'Negociação', order: 4, colorHex: '#fbbf24' },
              { name: 'Fechado — Ganho', order: 5, colorHex: '#22c55e', isWon: true },
              { name: 'Fechado — Perdido', order: 6, colorHex: '#ef4444', isLost: true },
            ],
          },
        },
      });
      await tx.creditPolicy.create({
        data: { organizationId: organization.id, name: 'Política Padrão', active: true, isDefault: true },
      });
      return organization;
    });

    await this.auditService.log({
      organizationId: organization.id,
      userId: actorUserId,
      action: 'BACKOFFICE_ORGANIZATION_CREATED',
      entityType: 'Organization',
      entityId: organization.id,
    });

    return this.getOrganization(organization.id);
  }

  /** Suspende (bloqueia login de todos os usuários) ou reativa uma empresa cliente. */
  async setOrganizationStatus(id: string, dto: UpdateOrganizationStatusDto, actorUserId: string) {
    await this.getOrganization(id);
    const organization = await this.prisma.organization.update({
      where: { id },
      data: { active: dto.active },
    });

    await this.auditService.log({
      organizationId: id,
      userId: actorUserId,
      action: dto.active ? 'BACKOFFICE_ORGANIZATION_REACTIVATED' : 'BACKOFFICE_ORGANIZATION_SUSPENDED',
      entityType: 'Organization',
      entityId: id,
    });

    return organization;
  }

  /** Aprova ou rejeita o cadastro de uma empresa que se auto-registrou em /registrar. */
  async decideApproval(id: string, dto: DecideApprovalDto, actorUserId: string) {
    const existing = await this.getOrganization(id);
    if (existing.approvalStatus !== 'PENDING') {
      throw new ConflictException('Este cadastro já foi analisado.');
    }

    const organization =
      dto.decision === 'APPROVE'
        ? await this.prisma.organization.update({
            where: { id },
            data: {
              approvalStatus: 'APPROVED',
              approvedAt: new Date(),
              rejectionReason: null,
              subscriptionStatus: 'TRIAL',
              trialEndsAt: daysFromNow(dto.trialDays ?? DEFAULT_TRIAL_DAYS),
            },
          })
        : await this.prisma.organization.update({
            where: { id },
            data: {
              approvalStatus: 'REJECTED',
              rejectionReason: dto.rejectionReason ?? null,
            },
          });

    await this.auditService.log({
      organizationId: id,
      userId: actorUserId,
      action: dto.decision === 'APPROVE' ? 'BACKOFFICE_ORGANIZATION_APPROVED' : 'BACKOFFICE_ORGANIZATION_REJECTED',
      entityType: 'Organization',
      entityId: id,
      metadata: dto.decision === 'APPROVE' ? { trialDays: dto.trialDays ?? DEFAULT_TRIAL_DAYS } : { rejectionReason: dto.rejectionReason },
    });

    return organization;
  }

  /** Edita manualmente o estado da assinatura mensal (sem gateway de pagamento integrado). */
  async updateSubscription(id: string, dto: UpdateSubscriptionDto, actorUserId: string) {
    await this.getOrganization(id);
    const organization = await this.prisma.organization.update({
      where: { id },
      data: {
        subscriptionStatus: dto.subscriptionStatus,
        subscriptionPlan: dto.subscriptionPlan,
        subscriptionPriceCents: dto.subscriptionPriceCents,
        nextBillingAt: dto.nextBillingAt ? new Date(dto.nextBillingAt) : undefined,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
        // Toda vez que o dono da plataforma mexe no plano/preço, pede pra
        // empresa confirmar de novo — evita "assinatura" antiga valendo
        // pra termos novos sem o ADMIN ter visto.
        subscriptionConfirmedAt: null,
      },
    });

    await this.auditService.log({
      organizationId: id,
      userId: actorUserId,
      action: 'BACKOFFICE_SUBSCRIPTION_UPDATED',
      entityType: 'Organization',
      entityId: id,
      metadata: { subscriptionStatus: dto.subscriptionStatus },
    });

    return organization;
  }
}
