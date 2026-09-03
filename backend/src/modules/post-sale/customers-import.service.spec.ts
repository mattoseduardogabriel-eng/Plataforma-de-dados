import { CustomersService } from './customers.service';

// Cobre só o fluxo de importação em job (startImportJob/processamento em
// segundo plano/getImportJob) — o resto de CustomersService (create,
// findAll, deleteMany/deleteAll) não muda nessa mudança.
describe('CustomersService — importação em job', () => {
  let service: CustomersService;
  let prisma: any;
  let auditService: any;
  let customerFieldsService: any;

  // Estado mutável do "banco" pro ImportJob — cada update precisa
  // enxergar o que o update anterior gravou, senão a asserção final
  // (status DONE, processedRows == totalRows) vê um objeto desatualizado.
  let job: any;

  beforeEach(() => {
    job = null;
    prisma = {
      importJob: {
        create: jest.fn().mockImplementation(({ data }) => {
          job = { id: 'job-1', processedRows: 0, created: 0, updated: 0, errors: null, status: 'PENDING', ...data };
          return Promise.resolve({ ...job });
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          job = { ...job, ...data };
          return Promise.resolve({ ...job });
        }),
        findFirst: jest.fn().mockImplementation(() => Promise.resolve(job ? { ...job } : null)),
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue(null), // ninguém pré-existe -> tudo "created"
        create: jest.fn().mockResolvedValue({ id: 'customer-x' }),
        update: jest.fn(),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    customerFieldsService = {};
    service = new CustomersService(prisma, auditService, customerFieldsService);
  });

  // Processamento roda "fire-and-forget" (void this.processImportJobInBackground(...))
  // — dá um tempo pro event loop rodar os awaits internos antes de checar o resultado.
  async function esperarProcessamento() {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('cria o job e devolve o id na hora, sem esperar o processamento', async () => {
    const rows = [{ name: 'Fulano' }, { name: 'Ciclano' }] as any;

    const resultado = await service.startImportJob('org-1', 'user-1', rows);

    expect(resultado).toEqual({ jobId: 'job-1', totalRows: 2 });
    expect(prisma.importJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', type: 'customers', totalRows: 2 }) }),
    );
  });

  it('processa todas as linhas em segundo plano e termina com status DONE', async () => {
    const rows = [{ name: 'Fulano' }, { name: 'Ciclano' }] as any;

    await service.startImportJob('org-1', 'user-1', rows);
    await esperarProcessamento();

    expect(job.status).toBe('DONE');
    expect(job.processedRows).toBe(2);
    expect(job.created).toBe(2);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CUSTOMERS_IMPORTED', metadata: expect.objectContaining({ created: 2 }) }),
    );
  });

  it('uma linha com erro vira entrada em errors, sem travar o resto do lote', async () => {
    prisma.customer.create.mockImplementation(({ data }: any) => {
      if (data.name === 'Quebra') throw new Error('CPF inválido');
      return Promise.resolve({ id: 'customer-x' });
    });
    const rows = [{ name: 'Fulano' }, { name: 'Quebra' }, { name: 'Ciclano' }] as any;

    await service.startImportJob('org-1', 'user-1', rows);
    await esperarProcessamento();

    expect(job.status).toBe('DONE');
    expect(job.created).toBe(2);
    expect(job.errors).toEqual([{ row: 2, name: 'Quebra', message: 'CPF inválido' }]);
  });

  it('rejeita de cara uma planilha acima do limite de linhas', async () => {
    const rows = Array.from({ length: 20001 }, (_, i) => ({ name: `Cliente ${i}` })) as any;

    await expect(service.startImportJob('org-1', 'user-1', rows)).rejects.toThrow(/20000/);
    expect(prisma.importJob.create).not.toHaveBeenCalled();
  });

  it('getImportJob devolve 404 quando o job não existe (ou é de outra organização)', async () => {
    prisma.importJob.findFirst.mockResolvedValue(null);
    await expect(service.getImportJob('org-1', 'job-inexistente')).rejects.toThrow('Importação não encontrada.');
  });

  it('getImportJob devolve o job quando existe', async () => {
    await service.startImportJob('org-1', 'user-1', [{ name: 'Fulano' }] as any);
    const encontrado = await service.getImportJob('org-1', 'job-1');
    expect(encontrado.id).toBe('job-1');
  });
});
