import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerFieldDefinitionDto } from './dto/customer-field-definition.dto';

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

@Injectable()
export class CustomerFieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll(organizationId: string) {
    return this.prisma.customerFieldDefinition.findMany({
      where: { organizationId },
      orderBy: { order: 'asc' },
    });
  }

  async create(organizationId: string, userId: string, dto: CreateCustomerFieldDefinitionDto) {
    const key = slugify(dto.label);
    if (!key) {
      throw new BadRequestException('Rótulo do campo inválido — use ao menos uma letra ou número.');
    }
    const existing = await this.prisma.customerFieldDefinition.findUnique({
      where: { organizationId_key: { organizationId, key } },
    });
    if (existing) {
      throw new BadRequestException(`Já existe um campo com esse nome ("${existing.label}").`);
    }

    const count = await this.prisma.customerFieldDefinition.count({ where: { organizationId } });
    const field = await this.prisma.customerFieldDefinition.create({
      data: {
        organizationId,
        key,
        label: dto.label,
        type: dto.type,
        options: dto.type === 'LISTA' ? dto.options ?? [] : [],
        order: count,
      },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CUSTOMER_FIELD_CREATED',
      entityType: 'CustomerFieldDefinition',
      entityId: field.id,
      metadata: { label: field.label, type: field.type },
    });

    return field;
  }

  async remove(organizationId: string, userId: string, id: string) {
    const field = await this.prisma.customerFieldDefinition.findFirst({ where: { id, organizationId } });
    if (!field) {
      throw new NotFoundException('Campo não encontrado.');
    }
    await this.prisma.customerFieldDefinition.delete({ where: { id } });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CUSTOMER_FIELD_REMOVED',
      entityType: 'CustomerFieldDefinition',
      entityId: id,
      metadata: { label: field.label },
    });

    // Os valores desse campo continuam guardados dentro do JSON dos
    // clientes (chave órfã) — inofensivo, e permite desfazer removendo o
    // registro em vez de perder o histórico. Não é limpo automaticamente.
    return { success: true };
  }
}
