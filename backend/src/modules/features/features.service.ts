import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ALL_FEATURE_KEYS, PLATFORM_FEATURES, isValidFeatureKey } from '../../common/features/platform-features';

function assertValidKeys(keys: string[]) {
  const invalid = keys.filter((k) => !isValidFeatureKey(k));
  if (invalid.length > 0) {
    throw new BadRequestException(`Ferramenta(s) desconhecida(s): ${invalid.join(', ')}`);
  }
}

@Injectable()
export class FeaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  catalog() {
    return PLATFORM_FEATURES;
  }

  /** Teto definido pelo dono da plataforma (backoffice) pra uma empresa. */
  async setOrganizationFeatures(organizationId: string, enabledFeatures: string[], actorUserId: string) {
    assertValidKeys(enabledFeatures);
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { enabledFeatures },
    });
    await this.auditService.log({
      organizationId,
      userId: actorUserId,
      action: 'BACKOFFICE_FEATURES_UPDATED',
      entityType: 'Organization',
      entityId: organizationId,
      metadata: { enabledFeatures },
    });
    return organization;
  }

  /**
   * Visão completa pro ADMIN/GESTOR da própria empresa: teto liberado pelo
   * dono da plataforma + o que cada setor/usuário tem bloqueado dentro dele.
   */
  async getOrganizationFeatureConfig(organizationId: string) {
    const [organization, sectors, users] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { enabledFeatures: true } }),
      this.prisma.organizationSector.findMany({
        where: { organizationId },
        select: { id: true, name: true, disabledFeatures: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { organizationId },
        select: { id: true, name: true, email: true, role: true, sectorId: true, disabledFeatures: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      catalog: PLATFORM_FEATURES,
      enabledFeatures: organization.enabledFeatures,
      sectors,
      users,
    };
  }

  /** ADMIN/GESTOR só pode desligar o que já está dentro do teto da empresa. */
  private async assertWithinOrgCeiling(organizationId: string, disabledFeatures: string[]) {
    assertValidKeys(disabledFeatures);
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { enabledFeatures: true },
    });
    const outsideCeiling = disabledFeatures.filter((k) => !organization.enabledFeatures.includes(k));
    // Bloquear algo que já está fora do teto é um no-op inofensivo — só
    // avisamos, não impedimos (evita erro confuso se o dono restringir
    // depois de o ADMIN já ter configurado algo).
    return outsideCeiling;
  }

  async setSectorFeatures(organizationId: string, sectorId: string, disabledFeatures: string[], actorUserId: string) {
    await this.assertWithinOrgCeiling(organizationId, disabledFeatures);
    const sector = await this.prisma.organizationSector.findFirst({ where: { id: sectorId, organizationId } });
    if (!sector) throw new NotFoundException('Setor não encontrado.');

    const updated = await this.prisma.organizationSector.update({
      where: { id: sectorId },
      data: { disabledFeatures },
    });
    await this.auditService.log({
      organizationId,
      userId: actorUserId,
      action: 'SECTOR_FEATURES_UPDATED',
      entityType: 'OrganizationSector',
      entityId: sectorId,
      metadata: { disabledFeatures },
    });
    return updated;
  }

  async setUserFeatures(organizationId: string, userId: string, disabledFeatures: string[], actorUserId: string) {
    await this.assertWithinOrgCeiling(organizationId, disabledFeatures);
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { disabledFeatures },
      select: { id: true, name: true, email: true, disabledFeatures: true },
    });
    await this.auditService.log({
      organizationId,
      userId: actorUserId,
      action: 'USER_FEATURES_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { disabledFeatures },
    });
    return updated;
  }

  /** Usado pelo FeatureGuard e por /organizations/me/features (o que o usuário logado enxerga). */
  async getEffectiveFeatures(organizationId: string, userId: string): Promise<Set<string>> {
    const [organization, user] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId }, select: { enabledFeatures: true } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { disabledFeatures: true, sector: { select: { disabledFeatures: true } } },
      }),
    ]);
    const orgFeatures = organization?.enabledFeatures ?? ALL_FEATURE_KEYS;
    const blocked = new Set([...(user?.sector?.disabledFeatures ?? []), ...(user?.disabledFeatures ?? [])]);
    return new Set(orgFeatures.filter((f) => !blocked.has(f)));
  }
}
