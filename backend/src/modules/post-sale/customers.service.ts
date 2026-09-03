import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { AuditService } from '../audit/audit.service';
import { CustomerFieldsService } from './customer-fields.service';
import { normalizePhone } from '../../common/utils/phone.util';
import { normalizePagination } from '../../common/utils/pagination.util';

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
  // Opcional de propósito: a tela de Carteira de Clientes depende de
  // receber TODOS os filtrados numa chamada só pra "selecionar todos os
  // filtrados"/"excluir todos os filtrados" funcionarem certo — só pagina
  // quando o chamador pede explicitamente (page informado), devolvendo
  // nesse caso um envelope { data, total, page, pageSize, totalPages } em
  // vez do array direto.
  page?: number;
  pageSize?: number;
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

    if (filters.page === undefined) {
      return this.prisma.customer.findMany({ where, orderBy });
    }

    const { page, pageSize } = normalizePagination(filters.page, filters.pageSize);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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

  /** Uma linha por vez dentro de processImportJob — extraído pra ficar testável isolado. */
  private async importRow(organizationId: string, row: CreateCustomerDto) {
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
      return 'updated' as const;
    }
    await this.prisma.customer.create({ data: { ...data, organizationId } });
    return 'created' as const;
  }

  // Nada de fila de verdade (Redis/BullMQ) de propósito — o problema real
  // (requisição HTTP travada minutos numa planilha grande, arriscando
  // timeout) já é resolvido processando em segundo plano dentro do próprio
  // processo, sem pedir infra nova. Limite conhecido: se o processo
  // reiniciar no meio de um job, ele fica preso em RUNNING pra sempre (as
  // linhas em si só existem na memória desse processo, não persistidas) —
  // aceitável pro volume de uso atual; migrar pra fila de verdade com
  // Redis é o próximo passo se isso virar problema na prática.
  private static readonly MAX_IMPORT_ROWS = 20000;
  private static readonly IMPORT_BATCH_SIZE = 50;

  /**
   * Cria o job de importação (planilha de Clientes) e devolve na hora —
   * o processamento de verdade roda em segundo plano (ver
   * processImportJobInBackground), sem o chamador esperar. Consulte o
   * progresso com getImportJob(jobId).
   */
  async startImportJob(organizationId: string, userId: string, rows: CreateCustomerDto[]): Promise<{ jobId: string; totalRows: number }> {
    if (rows.length > CustomersService.MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Essa planilha tem ${rows.length} linhas — o máximo por importação é ${CustomersService.MAX_IMPORT_ROWS}. Divida em arquivos menores.`,
      );
    }

    const job = await this.prisma.importJob.create({
      data: { organizationId, userId, type: 'customers', totalRows: rows.length },
    });

    // Fire-and-forget: não faz o chamador esperar o processamento — erro
    // inesperado aqui vira status FAILED no próprio job, nunca escapa pra
    // derrubar o processo (ver o catch dentro de processImportJobInBackground).
    void this.processImportJobInBackground(job.id, organizationId, userId, rows);

    return { jobId: job.id, totalRows: rows.length };
  }

  private async processImportJobInBackground(jobId: string, organizationId: string, userId: string, rows: CreateCustomerDto[]): Promise<void> {
    const errors: ImportCustomersResult['errors'] = [];
    let created = 0;
    let updated = 0;

    try {
      await this.prisma.importJob.update({ where: { id: jobId }, data: { status: 'RUNNING' } });

      for (let inicio = 0; inicio < rows.length; inicio += CustomersService.IMPORT_BATCH_SIZE) {
        const lote = rows.slice(inicio, inicio + CustomersService.IMPORT_BATCH_SIZE);

        for (let j = 0; j < lote.length; j++) {
          const indiceGlobal = inicio + j;
          try {
            const resultado = await this.importRow(organizationId, lote[j]);
            if (resultado === 'created') created += 1;
            else updated += 1;
          } catch (error) {
            errors.push({
              row: indiceGlobal + 1,
              name: lote[j].name,
              message: error instanceof Error ? error.message : 'Erro desconhecido ao importar linha.',
            });
          }
        }

        // Progresso visível a cada lote, não a cada linha — uma planilha
        // de milhares de linhas não vira milhares de UPDATE no ImportJob.
        await this.prisma.importJob.update({
          where: { id: jobId },
          data: { processedRows: Math.min(inicio + lote.length, rows.length), created, updated, errors },
        });
      }

      await this.prisma.importJob.update({ where: { id: jobId }, data: { status: 'DONE' } });

      await this.auditService.log({
        organizationId,
        userId,
        action: 'CUSTOMERS_IMPORTED',
        entityType: 'Customer',
        metadata: { created, updated, errorCount: errors.length },
      });
    } catch (error) {
      await this.prisma.importJob
        .update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Erro desconhecido ao processar a importação.',
          },
        })
        .catch(() => {});
    }
  }

  async getImportJob(organizationId: string, jobId: string) {
    const job = await this.prisma.importJob.findFirst({ where: { id: jobId, organizationId } });
    if (!job) {
      throw new NotFoundException('Importação não encontrada.');
    }
    return job;
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
