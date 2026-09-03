import { AuditService } from './audit.service';

describe('AuditService.purgeOldEntries', () => {
  let service: AuditService;
  let prisma: any;

  beforeEach(() => {
    prisma = { auditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) } };
    service = new AuditService(prisma);
  });

  it('apaga entradas mais antigas que o corte informado e devolve a contagem', async () => {
    const resultado = await service.purgeOldEntries(730);

    expect(resultado).toBe(5);
    const { where } = prisma.auditLog.deleteMany.mock.calls[0][0];
    const diasDeDiferenca = (Date.now() - where.createdAt.lt.getTime()) / (24 * 60 * 60 * 1000);
    expect(diasDeDiferenca).toBeCloseTo(730, 0);
  });
});
