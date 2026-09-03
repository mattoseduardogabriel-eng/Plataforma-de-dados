import { AuditRetentionScheduler } from './audit-retention.scheduler';

describe('AuditRetentionScheduler', () => {
  let scheduler: AuditRetentionScheduler;
  let auditService: any;
  let configService: any;

  beforeEach(() => {
    auditService = { purgeOldEntries: jest.fn().mockResolvedValue(0) };
    configService = { get: jest.fn().mockReturnValue(undefined) };
    scheduler = new AuditRetentionScheduler(auditService, configService);
  });

  it('usa a retenção padrão (730 dias) quando não configurado', async () => {
    await scheduler.expurgarAuditoriaAntiga();
    expect(auditService.purgeOldEntries).toHaveBeenCalledWith(730);
  });

  it('usa AUDIT_LOG_RETENTION_DAYS quando configurado', async () => {
    configService.get.mockReturnValue('90');
    await scheduler.expurgarAuditoriaAntiga();
    expect(auditService.purgeOldEntries).toHaveBeenCalledWith(90);
  });

  it('nunca lança erro pra quem chamou, mesmo se a purga falhar', async () => {
    auditService.purgeOldEntries.mockRejectedValue(new Error('banco fora do ar'));
    await expect(scheduler.expurgarAuditoriaAntiga()).resolves.toBeUndefined();
  });
});
