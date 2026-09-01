import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSectorDto } from './dto/sector.dto';

@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.organizationSector.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async create(organizationId: string, dto: CreateSectorDto) {
    const existing = await this.prisma.organizationSector.findFirst({
      where: { organizationId, name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(`Já existe um setor chamado "${dto.name}".`);
    }
    return this.prisma.organizationSector.create({ data: { organizationId, name: dto.name } });
  }

  async remove(organizationId: string, id: string) {
    const sector = await this.prisma.organizationSector.findFirst({ where: { id, organizationId } });
    if (!sector) {
      throw new NotFoundException('Setor não encontrado.');
    }
    await this.prisma.organizationSector.delete({ where: { id } });
    return { success: true };
  }
}
