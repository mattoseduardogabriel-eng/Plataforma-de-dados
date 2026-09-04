import { createHmac } from 'node:crypto';
import { LiroCrmService } from './liro-crm.service';
import { SecretCipher } from '../../../common/crypto/secret-cipher';

// Cobre só a verificação de assinatura do webhook (X-Liro-Signature) —
// a parte crítica de segurança dessa integração: uma entrega forjada não
// pode mexer no funil, mas uma organização que ainda não tem segredo
// salvo (ou um Liro desatualizado sem o header) não pode ficar travada.
describe('LiroCrmService — verificação de assinatura do webhook', () => {
  let service: LiroCrmService;
  let prisma: any;
  const cipher = new SecretCipher({ get: () => 'chave-de-teste-32-bytes-bem-grande' } as any);

  const org = { id: 'org-1', liroWebhookToken: 'token-abc' };

  beforeEach(() => {
    prisma = {
      organization: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      lead: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new LiroCrmService(
      prisma,
      cipher,
      {} as any,
      { log: jest.fn() } as any,
      { get: jest.fn() } as any,
      { publish: jest.fn() } as any,
    );
  });

  it('aceita a entrega quando a assinatura bate com o segredo salvo', async () => {
    const segredo = 'segredo-do-webhook';
    prisma.organization.findFirst.mockResolvedValue({
      ...org,
      liroWebhookSigningSecretEncrypted: cipher.encrypt(segredo),
    });
    const payload = { event: 'conversation_moved', contact: { id: 'assinatura-ok', phoneNumber: '5544998771425' } };
    const corpo = JSON.stringify(payload);
    const assinatura = `sha256=${createHmac('sha256', segredo).update(corpo).digest('hex')}`;

    await service.handleInboundWebhook('token-abc', payload, corpo, assinatura);

    // Passou da verificação e seguiu pro fluxo normal (buscou leads).
    expect(prisma.lead.findMany).toHaveBeenCalledTimes(1);
  });

  it('rejeita a entrega quando a assinatura não bate (forjada/adulterada)', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      ...org,
      liroWebhookSigningSecretEncrypted: cipher.encrypt('segredo-do-webhook'),
    });
    const payload = { event: 'conversation_moved', contact: { id: 'assinatura-forjada', phoneNumber: '5544998771425' } };
    const corpo = JSON.stringify(payload);

    await service.handleInboundWebhook('token-abc', payload, corpo, 'sha256=assinatura-forjada-invalida');

    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  it('aceita sem verificar quando a organização ainda não tem segredo salvo (compatibilidade)', async () => {
    prisma.organization.findFirst.mockResolvedValue({ ...org, liroWebhookSigningSecretEncrypted: null });
    const payload = { event: 'conversation_moved', contact: { id: 'sem-segredo-salvo', phoneNumber: '5544998771425' } };

    await service.handleInboundWebhook('token-abc', payload, JSON.stringify(payload), undefined);

    expect(prisma.lead.findMany).toHaveBeenCalledTimes(1);
  });

  it('aceita sem verificar quando não veio o header (Liro desatualizado)', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      ...org,
      liroWebhookSigningSecretEncrypted: cipher.encrypt('segredo-do-webhook'),
    });
    const payload = { event: 'conversation_moved', contact: { id: 'sem-header', phoneNumber: '5544998771425' } };

    await service.handleInboundWebhook('token-abc', payload, JSON.stringify(payload), undefined);

    expect(prisma.lead.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('LiroCrmService — dedupe de reentrega do webhook', () => {
  let service: LiroCrmService;
  let prisma: any;
  const cipher = new SecretCipher({ get: () => 'chave-de-teste-32-bytes-bem-grande' } as any);
  const org = { id: 'org-1', liroWebhookToken: 'token-dedupe' };

  beforeEach(() => {
    prisma = {
      organization: { findFirst: jest.fn().mockResolvedValue({ ...org, liroWebhookSigningSecretEncrypted: null }) },
      lead: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new LiroCrmService(
      prisma,
      cipher,
      {} as any,
      { log: jest.fn() } as any,
      { get: jest.fn() } as any,
      { publish: jest.fn() } as any,
    );
  });

  it('processa a mesma entrega (mesmo corpo bruto) só uma vez — reentrega é ignorada', async () => {
    const payload = { event: 'conversation_moved', contact: { id: 'dedupe-1', phoneNumber: '5544998771425' } };
    const corpo = JSON.stringify(payload);

    await service.handleInboundWebhook('token-dedupe', payload, corpo, undefined);
    await service.handleInboundWebhook('token-dedupe', payload, corpo, undefined); // reentrega (Liro reenviando)

    expect(prisma.lead.findMany).toHaveBeenCalledTimes(1);
  });

  it('processa entregas com corpo diferente normalmente, mesmo do mesmo token', async () => {
    const payload1 = { event: 'conversation_moved', contact: { id: 'dedupe-2a', phoneNumber: '5544998771425' } };
    const payload2 = { event: 'conversation_moved', contact: { id: 'dedupe-2b', phoneNumber: '5544998771426' } };

    await service.handleInboundWebhook('token-dedupe', payload1, JSON.stringify(payload1), undefined);
    await service.handleInboundWebhook('token-dedupe', payload2, JSON.stringify(payload2), undefined);

    expect(prisma.lead.findMany).toHaveBeenCalledTimes(2);
  });
});

// Sincronização de tarefas — Aster → Liro (pushTaskCreate/Update/Delete,
// chamados por ActivitiesService). Melhor esforço: nunca lança, só loga.
describe('LiroCrmService — sincronização de tarefas (Aster → Liro)', () => {
  let service: LiroCrmService;
  let prisma: any;
  let connector: any;
  const cipher = new SecretCipher({ get: () => 'chave-de-teste-32-bytes-bem-grande' } as any);
  const orgConfigurada = {
    id: 'org-1',
    liroCrmApiKeyEncrypted: cipher.encrypt('chave-liro'),
    liroCrmBaseUrl: 'https://liro.example.com',
  };

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn() },
      activity: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    };
    connector = {
      upsertTask: jest.fn().mockResolvedValue({ id: 'liro-task-1', externalId: 'activity-1' }),
      patchTask: jest.fn().mockResolvedValue({ id: 'liro-task-1', externalId: 'activity-1' }),
      deleteTask: jest.fn().mockResolvedValue({ deleted: true }),
    };
    service = new LiroCrmService(
      prisma,
      cipher,
      connector,
      { log: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any,
      { get: jest.fn() } as any,
      { publish: jest.fn() } as any,
    );
  });

  it('pushTaskCreate: integração não configurada — nem chama o Liro', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org-1', liroCrmApiKeyEncrypted: null, liroCrmBaseUrl: null });

    await service.pushTaskCreate('org-1', 'activity-1');

    expect(connector.upsertTask).not.toHaveBeenCalled();
  });

  it('pushTaskCreate: cria no Liro e guarda o id devolvido em Activity.externalId', async () => {
    prisma.organization.findUnique.mockResolvedValue(orgConfigurada);
    prisma.activity.findFirst.mockResolvedValue({
      id: 'activity-1',
      title: 'Ligar pro cliente',
      dueDate: null,
      doneAt: null,
      externalId: null,
      assignedTo: { email: 'vendedor@empresa.com' },
      createdBy: { email: 'gestor@empresa.com' },
      lead: { phone: '5511999998888' },
    });

    await service.pushTaskCreate('org-1', 'activity-1');

    expect(connector.upsertTask).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ externalId: 'activity-1', title: 'Ligar pro cliente', assignedUserEmail: 'vendedor@empresa.com' }),
    );
    expect(prisma.activity.update).toHaveBeenCalledWith({ where: { id: 'activity-1' }, data: { externalId: 'liro-task-1' } });
  });

  it('pushTaskCreate: já tem externalId (já sincronizada antes) — não cria de novo', async () => {
    prisma.organization.findUnique.mockResolvedValue(orgConfigurada);
    prisma.activity.findFirst.mockResolvedValue({ id: 'activity-1', externalId: 'ja-sincronizada' });

    await service.pushTaskCreate('org-1', 'activity-1');

    expect(connector.upsertTask).not.toHaveBeenCalled();
  });

  it('pushTaskUpdate: sem externalId ainda (criação original nunca sincronizou) — tenta criar em vez de desistir', async () => {
    prisma.organization.findUnique.mockResolvedValue(orgConfigurada);
    prisma.activity.findFirst.mockResolvedValue({
      id: 'activity-2',
      title: 'Tarefa',
      dueDate: null,
      doneAt: null,
      externalId: null,
      assignedTo: null,
      createdBy: null,
      lead: null,
    });

    await service.pushTaskUpdate('org-1', 'activity-2');

    expect(connector.upsertTask).toHaveBeenCalled();
    expect(connector.patchTask).not.toHaveBeenCalled();
  });

  it('pushTaskUpdate: com externalId, atualiza por lá (PATCH pelo id do Liro)', async () => {
    prisma.organization.findUnique.mockResolvedValue(orgConfigurada);
    prisma.activity.findFirst.mockResolvedValue({
      id: 'activity-3',
      title: 'Tarefa concluída',
      dueDate: null,
      doneAt: new Date(),
      externalId: 'liro-task-3',
      assignedTo: { email: 'a@b.com' },
      lead: null,
    });

    await service.pushTaskUpdate('org-1', 'activity-3');

    expect(connector.patchTask).toHaveBeenCalledWith(expect.anything(), 'liro-task-3', expect.objectContaining({ done: true }));
  });

  it('pushTaskDelete: sem externalId (nunca sincronizou) — nem tenta chamar o Liro', async () => {
    await service.pushTaskDelete('org-1', null);

    expect(connector.deleteTask).not.toHaveBeenCalled();
  });

  it('pushTaskDelete: com externalId, exclui por lá', async () => {
    prisma.organization.findUnique.mockResolvedValue(orgConfigurada);

    await service.pushTaskDelete('org-1', 'liro-task-4');

    expect(connector.deleteTask).toHaveBeenCalledWith(expect.anything(), 'liro-task-4');
  });
});

// Sincronização de tarefas — Liro → Aster, via handleInboundWebhook (os
// mesmos 4 eventos que o Liro dispara). Escreve direto via Prisma —
// nunca deve chamar de volta pushTaskCreate/Update (ping-pong).
describe('LiroCrmService — sincronização de tarefas (Liro → Aster, via webhook)', () => {
  let service: LiroCrmService;
  let prisma: any;
  const cipher = new SecretCipher({ get: () => 'chave-de-teste-32-bytes-bem-grande' } as any);
  const org = { id: 'org-1', liroWebhookToken: 'token-tarefas', liroWebhookSigningSecretEncrypted: null };

  beforeEach(() => {
    prisma = {
      organization: { findFirst: jest.fn().mockResolvedValue(org) },
      activity: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: { findFirst: jest.fn() },
      lead: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new LiroCrmService(
      prisma,
      cipher,
      {} as any,
      { log: jest.fn(), warn: jest.fn(), debug: jest.fn() } as any,
      { get: jest.fn() } as any,
      { publish: jest.fn() } as any,
    );
  });

  it('task_created: casa responsável/criador pelo e-mail e cria a atividade (origin=liro)', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'user-vendedor' }); // assignedUserEmail
    prisma.user.findFirst.mockResolvedValueOnce({ id: 'user-gestor' }); // createdByEmail

    const payload = {
      event: 'task_created',
      task: {
        id: 'liro-task-1',
        title: 'Ligar pro cliente',
        dueDate: null,
        done: false,
        contact: null,
        assignedUserEmail: 'vendedor@empresa.com',
        createdByEmail: 'gestor@empresa.com',
      },
    };

    await service.handleInboundWebhook('token-tarefas', payload, JSON.stringify(payload), undefined);

    expect(prisma.activity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { externalId: 'liro-task-1' },
        create: expect.objectContaining({
          createdById: 'user-gestor',
          assignedToId: 'user-vendedor',
          origin: 'liro',
          type: 'TAREFA',
          externalId: 'liro-task-1',
        }),
      }),
    );
  });

  it('sem usuário nenhum batendo por e-mail (nem responsável, nem criador) — ignora sem quebrar', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const payload = {
      event: 'task_created',
      task: { id: 'liro-task-2', title: 'Tarefa órfã', assignedUserEmail: 'ninguem@empresa.com', createdByEmail: 'tambem-ninguem@empresa.com' },
    };

    await service.handleInboundWebhook('token-tarefas', payload, JSON.stringify(payload), undefined);

    expect(prisma.activity.upsert).not.toHaveBeenCalled();
  });

  it('task_deleted: exclui a atividade correspondente (achada pelo externalId)', async () => {
    prisma.activity.findFirst.mockResolvedValue({ id: 'activity-x', externalId: 'liro-task-3' });

    const payload = { event: 'task_deleted', task: { id: 'liro-task-3' } };
    await service.handleInboundWebhook('token-tarefas', payload, JSON.stringify(payload), undefined);

    expect(prisma.activity.delete).toHaveBeenCalledWith({ where: { id: 'activity-x' } });
  });

  it('task_deleted: tarefa nunca existiu aqui — não quebra, não faz nada', async () => {
    prisma.activity.findFirst.mockResolvedValue(null);

    const payload = { event: 'task_deleted', task: { id: 'liro-task-inexistente' } };
    await service.handleInboundWebhook('token-tarefas', payload, JSON.stringify(payload), undefined);

    expect(prisma.activity.delete).not.toHaveBeenCalled();
  });
});
