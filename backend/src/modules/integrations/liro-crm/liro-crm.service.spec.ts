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
    service = new LiroCrmService(prisma, cipher, {} as any, { log: jest.fn() } as any, { get: jest.fn() } as any);
  });

  it('aceita a entrega quando a assinatura bate com o segredo salvo', async () => {
    const segredo = 'segredo-do-webhook';
    prisma.organization.findFirst.mockResolvedValue({
      ...org,
      liroWebhookSigningSecretEncrypted: cipher.encrypt(segredo),
    });
    const payload = { event: 'conversation_moved', contact: { id: 'c1', phoneNumber: '5544998771425' } };
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
    const payload = { event: 'conversation_moved', contact: { id: 'c1', phoneNumber: '5544998771425' } };
    const corpo = JSON.stringify(payload);

    await service.handleInboundWebhook('token-abc', payload, corpo, 'sha256=assinatura-forjada-invalida');

    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  it('aceita sem verificar quando a organização ainda não tem segredo salvo (compatibilidade)', async () => {
    prisma.organization.findFirst.mockResolvedValue({ ...org, liroWebhookSigningSecretEncrypted: null });
    const payload = { event: 'conversation_moved', contact: { id: 'c1', phoneNumber: '5544998771425' } };

    await service.handleInboundWebhook('token-abc', payload, JSON.stringify(payload), undefined);

    expect(prisma.lead.findMany).toHaveBeenCalledTimes(1);
  });

  it('aceita sem verificar quando não veio o header (Liro desatualizado)', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      ...org,
      liroWebhookSigningSecretEncrypted: cipher.encrypt('segredo-do-webhook'),
    });
    const payload = { event: 'conversation_moved', contact: { id: 'c1', phoneNumber: '5544998771425' } };

    await service.handleInboundWebhook('token-abc', payload, JSON.stringify(payload), undefined);

    expect(prisma.lead.findMany).toHaveBeenCalledTimes(1);
  });
});
