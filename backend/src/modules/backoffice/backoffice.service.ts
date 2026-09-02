import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto';

const SALT_ROUNDS = 10;

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

    const organization = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.organizationName, cnpj: dto.organizationCnpj },
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
}
