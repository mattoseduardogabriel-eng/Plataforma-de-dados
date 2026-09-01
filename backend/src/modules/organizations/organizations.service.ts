import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
