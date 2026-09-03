import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuditService } from '../audit/audit.service';
import { CustomerFieldsService } from './customer-fields.service';
import { normalizePhone } from '../../common/utils/phone.util';

export interface ImportCustomersResult {
  created: number;
  updated: number;
  errors: { row: number; name?: string; message: string }[];
}

export interface CustomerListFilters {
  /** Filtro "contém", texto livre, por coluna — usados pelo popover de filtro do cabeçalho. */
  name?: string;
  document?: string;
  city?: string;
  planName?: string;
  /** Múltiplos valores selecionados (checkbox no popover), combinados com OR. */
  status?: string[];
  churnRiskLevel?: string[];
  /** JSON-encoded: { [chave do campo personalizado]: string | boolean } */
  customFields?: string;
  sortBy?: 'name' | 'document' | 'city' | 'planName' | 'monthlyValue' | 'status' | 'createdAt';
  sortDir?: 'asc' | 'desc';
  /** Mantido por compatibilidade com a busca antiga (nome ou documento). */
  search?: string;
}

const SORTABLE_COLUMNS: NonNullable<CustomerListFilters['sortBy']>[] = [
  'name',
  'document',
  'city',
  'planName',
  'monthlyValue',
  'status',
  'createdAt',
];

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly customerFieldsService: CustomerFieldsService,
  ) {}

  create(organizationId: string, dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        ...dto,
        // Sempre 55 + DDD + 9 dígitos — sem isso, um cliente cadastrado à
        // mão fica com o telefone num formato diferente do resto da
        // integração, e casamentos por telefone deixam de achar esse
        // registro.
        phone: dto.phone ? (normalizePhone(dto.phone) ?? dto.phone) : dto.phone,
        organizationId,
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined,
      },
    });
  }

  async findAll(organizationId: string, filters: CustomerListFilters) {
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      name: filters.name ? { contains: filters.name, mode: 'insensitive' } : undefined,
      document: filters.document ? { contains: filters.document.replace(/\D/g, '') || filters.document } : undefined,
      city: filters.city ? { contains: filters.city, mode: 'insensitive' } : undefined,
      planName: filters.planName ? { contains: filters.planName, mode: 'insensitive' } : undefined,
      status: filters.status?.length ? { in: filters.status as any } : undefined,
      churnRiskLevel: filters.churnRiskLevel?.length ? { in: filters.churnRiskLevel as any } : undefined,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { document: { contains: filters.search.replace(/\D/g, '') || filters.search } },
          ]
        : undefined,
      AND: await this.buildCustomFieldsWhere(organizationId, filters.customFields),
    };

    const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
      filters.sortBy && SORTABLE_COLUMNS.includes(filters.sortBy)
        ? [{ [filters.sortBy]: filters.sortDir ?? 'asc' } as Prisma.CustomerOrderByWithRelationInput]
        : [{ churnRiskScore: 'desc' }, { createdAt: 'desc' }];

    return this.prisma.customer.findMany({ where, orderBy });
  }

  /**
   * Traduz o filtro de campos personalizados (JSON-encoded, vindo do
   * popover de cada coluna) em condições Prisma sobre o JSON `customFields`
   * — usa `equals` para BOOLEANO/LISTA (valor exato) e `string_contains`
   * para TEXTO (busca parcial), de acordo com o tipo cadastrado do campo.
   */
  private async buildCustomFieldsWhere(
    organizationId: string,
    customFieldsJson?: string,
  ): Promise<Prisma.CustomerWhereInput[] | undefined> {
    if (!customFieldsJson) return undefined;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(customFieldsJson);
    } catch {
      return undefined;
    }
    const keys = Object.keys(parsed).filter((k) => parsed[k] !== '' && parsed[k] != null);
    if (!keys.length) return undefined;

    const definitions = await this.customerFieldsService.findAll(organizationId);
    const byKey = new Map(definitions.map((d) => [d.key, d]));

    return keys
      .map((key): Prisma.CustomerWhereInput | null => {
        const def = byKey.get(key);
        if (!def) return null;
        const value = parsed[key];
        if (def.type === 'TEXTO') {
          // Filtro de JSON no Postgres via Prisma não suporta `mode:
          // insensitive` pra string_contains nesta versão — fica
          // case-sensitive (diferente dos filtros "contém" nas colunas
          // fixas, que usam `mode: insensitive` normalmente).
          return { customFields: { path: [key], string_contains: String(value) } };
        }
        return { customFields: { path: [key], equals: value as Prisma.InputJsonValue } };
      })
      .filter((c): c is Prisma.CustomerWhereInput => c !== null);
  }

  async findOne(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId },
      include: {
        contracts: { orderBy: { startDate: 'desc' } },
        interactions: { orderBy: { createdAt: 'desc' }, include: { createdBy: { select: { id: true, name: true } } } },
        churnSignals: { orderBy: { createdAt: 'desc' } },
        transactions: { orderBy: { dueDate: 'desc' }, take: 10 },
      },
    });
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado.');
    }
    return customer;
  }

  /**
   * Importação em massa (planilha) — faz upsert por documento (CPF/CNPJ)
   * dentro da organização: já existe → atualiza; não existe → cria. Uma
   * linha inválida não derruba o lote inteiro, só é reportada em `errors`.
   */
  async importMany(organizationId: string, userId: string, rows: CreateCustomerDto[]): Promise<ImportCustomersResult> {
    const result: ImportCustomersResult = { created: 0, updated: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const cleanDocument = row.document?.replace(/\D/g, '') || undefined;
        const existing = cleanDocument
          ? await this.prisma.customer.findFirst({ where: { organizationId, document: cleanDocument } })
          : null;

        const data = {
          ...row,
          document: cleanDocument,
          phone: row.phone ? (normalizePhone(row.phone) ?? row.phone) : row.phone,
          contractStartDate: row.contractStartDate ? new Date(row.contractStartDate) : undefined,
        };

        if (existing) {
          await this.prisma.customer.update({ where: { id: existing.id }, data });
          result.updated += 1;
        } else {
          await this.prisma.customer.create({ data: { ...data, organizationId } });
          result.created += 1;
        }
      } catch (error) {
        result.errors.push({
          row: i + 1,
          name: row.name,
          message: error instanceof Error ? error.message : 'Erro desconhecido ao importar linha.',
        });
      }
    }

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CUSTOMERS_IMPORTED',
      entityType: 'Customer',
      metadata: { created: result.created, updated: result.updated, errorCount: result.errors.length },
    });

    return result;
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(organizationId, id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...dto,
        phone: dto.phone ? (normalizePhone(dto.phone) ?? dto.phone) : dto.phone,
        contractStartDate: dto.contractStartDate ? new Date(dto.contractStartDate) : undefined,
      },
    });
  }

  /**
   * Exclusão em massa por lista de ids — usada tanto pra exclusão manual
   * (seleção de linhas na tela) quanto pra "selecionar todos os filtrados
   * e excluir" (o front já resolve o filtro em ids antes de chamar aqui).
   * `deleteMany` já é escopado por organizationId, então um id de outra
   * organização passado por engano simplesmente não é apagado.
   */
  async deleteMany(organizationId: string, userId: string, ids: string[]) {
    const result = await this.prisma.customer.deleteMany({
      where: { organizationId, id: { in: ids } },
    });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CUSTOMERS_DELETED',
      entityType: 'Customer',
      metadata: { requested: ids.length, deleted: result.count },
    });

    return { deleted: result.count };
  }

  /**
   * Apaga TODA a carteira de clientes da organização — ação destrutiva e
   * irreversível, pensada pra "zerar a base" (ex: antes de reimportar do
   * zero). Não recebe filtro nenhum de propósito: se a intenção for
   * excluir só um subconjunto, o caminho é selecionar as linhas filtradas
   * na tela e usar `deleteMany` acima.
   */
  async deleteAll(organizationId: string, userId: string) {
    const result = await this.prisma.customer.deleteMany({ where: { organizationId } });

    await this.auditService.log({
      organizationId,
      userId,
      action: 'CUSTOMERS_ALL_DELETED',
      entityType: 'Customer',
      metadata: { deleted: result.count },
    });

    return { deleted: result.count };
  }
}
