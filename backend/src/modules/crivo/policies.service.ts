import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreatePolicyDto) {
    if (dto.isDefault) {
      await this.prisma.creditPolicy.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.creditPolicy.create({ data: { ...dto, organizationId } });
  }

  findAll(organizationId: string) {
    return this.prisma.creditPolicy.findMany({
      where: { organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(organizationId: string, id: string) {
    const policy = await this.prisma.creditPolicy.findFirst({ where: { id, organizationId } });
    if (!policy) {
      throw new NotFoundException('Política de crédito não encontrada.');
    }
    return policy;
  }

  async findDefault(organizationId: string) {
    const policy = await this.prisma.creditPolicy.findFirst({
      where: { organizationId, active: true, isDefault: true },
    });
    if (policy) return policy;

    const anyActive = await this.prisma.creditPolicy.findFirst({
      where: { organizationId, active: true },
      orderBy: { createdAt: 'asc' },
    });
    if (anyActive) return anyActive;

    throw new NotFoundException(
      'Nenhuma política de crédito ativa configurada. Crie uma em Configurações → Crivo.',
    );
  }

  async update(organizationId: string, id: string, dto: UpdatePolicyDto) {
    await this.findOne(organizationId, id);
    if (dto.isDefault) {
      await this.prisma.creditPolicy.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.creditPolicy.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.creditPolicy.update({ where: { id }, data: { active: false } });
    return { success: true };
  }
}
