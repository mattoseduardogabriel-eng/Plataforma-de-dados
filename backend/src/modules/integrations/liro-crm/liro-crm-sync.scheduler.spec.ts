import { LiroCrmSyncScheduler } from './liro-crm-sync.scheduler';

// Cobre só a parte de alerta de falha PERSISTENTE — o resto (importar
// contato, mapear etapa) já é coberto pelos testes de LiroCrmService.
describe('LiroCrmSyncScheduler — alerta de falha seguida', () => {
  let scheduler: LiroCrmSyncScheduler;
  let prisma: any;
  let liroCrmService: any;
  let auditService: any;

  const org = { id: 'org-1', name: 'Empresa X' };

  beforeEach(() => {
    prisma = {
      organization: {
        findMany: jest.fn().mockResolvedValue([org]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    };
    liroCrmService = { syncContacts: jest.fn() };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    scheduler = new LiroCrmSyncScheduler(prisma, liroCrmService, auditService);
  });

  it('zera o contador de falhas (updateMany condicional) quando o sync tem sucesso', async () => {
    liroCrmService.syncContacts.mockResolvedValue({ created: 1, updated: 0, total: 1 });

    await scheduler.sincronizarTodasAsOrganizacoes();

    expect(prisma.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1', liroCrmSyncFailureCount: { not: 0 } },
        data: { liroCrmSyncFailureCount: 0, liroCrmLastSyncError: null },
      }),
    );
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('incrementa o contador quando o sync falha, sem alertar antes do limite', async () => {
    liroCrmService.syncContacts.mockRejectedValue(new Error('chave revogada'));
    prisma.organization.update.mockResolvedValue({ liroCrmSyncFailureCount: 2 });

    await scheduler.sincronizarTodasAsOrganizacoes();

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'org-1' },
        data: expect.objectContaining({ liroCrmSyncFailureCount: { increment: 1 } }),
      }),
    );
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('registra o alerta só na rodada exata em que cruza o limite (5)', async () => {
    liroCrmService.syncContacts.mockRejectedValue(new Error('chave revogada'));
    prisma.organization.update.mockResolvedValue({ liroCrmSyncFailureCount: 5 });

    await scheduler.sincronizarTodasAsOrganizacoes();

    expect(auditService.log).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', action: 'LIRO_CRM_SYNC_REPEATED_FAILURE' }),
    );
  });

  it('não alerta de novo numa rodada além do limite (já alertou antes)', async () => {
    liroCrmService.syncContacts.mockRejectedValue(new Error('chave revogada'));
    prisma.organization.update.mockResolvedValue({ liroCrmSyncFailureCount: 6 });

    await scheduler.sincronizarTodasAsOrganizacoes();

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('uma organização falhando não impede as outras de sincronizar', async () => {
    const orgQuebrada = { id: 'org-quebrada', name: 'Quebrada' };
    const orgOk = { id: 'org-ok', name: 'OK' };
    prisma.organization.findMany.mockResolvedValue([orgQuebrada, orgOk]);
    liroCrmService.syncContacts.mockImplementation((id: string) =>
      id === 'org-quebrada' ? Promise.reject(new Error('fora do ar')) : Promise.resolve({ created: 0, updated: 0, total: 0 }),
    );
    prisma.organization.update.mockResolvedValue({ liroCrmSyncFailureCount: 1 });

    await scheduler.sincronizarTodasAsOrganizacoes();

    expect(liroCrmService.syncContacts).toHaveBeenCalledTimes(2);
  });
});
