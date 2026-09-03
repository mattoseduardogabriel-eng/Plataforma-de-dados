import { LeadsService } from './leads.service';

// Cobre só a paginação de findAll — o resto (create/update/merge) já tem
// cobertura indireta via deals.service.spec.ts e os testes de integração
// manuais documentados no PR de normalização de telefone.
describe('LeadsService — paginação de findAll', () => {
  let service: LeadsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      lead: {
        findMany: jest.fn().mockResolvedValue([{ id: 'lead-1' }]),
        count: jest.fn().mockResolvedValue(42),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new LeadsService(prisma);
  });

  it('usa página 1 e pageSize 25 por padrão, devolvendo o envelope com total/totalPages', async () => {
    const result = await service.findAll('org-1', {});

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 25 }),
    );
    expect(result).toEqual({ data: [{ id: 'lead-1' }], total: 42, page: 1, pageSize: 25, totalPages: 2 });
  });

  it('calcula o skip certo pra páginas além da primeira', async () => {
    await service.findAll('org-1', { page: 3, pageSize: 10 });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});
