import { DealsService } from './deals.service';

// Testa o caminho de dinheiro de verdade: fechar uma negociação como
// "Ganho" precisa criar cliente + contrato + lançamento financeiro
// exatamente uma vez, nunca duplicar se markWon rodar de novo (ex: closed
// duas vezes por engano), e "Perdido" não pode criar nada disso.
describe('DealsService', () => {
  let service: DealsService;
  let prisma: any;
  let liroCrmService: any;
  let auditService: any;
  let realtimeService: any;

  const baseDeal = {
    id: 'deal-1',
    title: 'Internet Empresarial 500Mb',
    value: 199.9,
    productPlan: 'Internet 500Mb',
    leadId: 'lead-1',
    pipelineId: 'pipe-1',
    stageId: 'stage-aberto',
    status: 'ABERTO',
  };

  const lead = {
    id: 'lead-1',
    name: 'Fulano da Silva',
    document: '12345678900',
    documentType: 'CPF',
    email: 'fulano@example.com',
    phone: '5544998771425',
  };

  // Estado mutável do "banco" pra esse deal — findFirst e update precisam
  // enxergar o mesmo objeto, senão um teste que sobrescreve um campo (ex:
  // productPlan: null) só muda o que o findFirst devolve, e o update
  // continua devolvendo o valor antigo pro markWon usar.
  let currentDeal: any;

  beforeEach(() => {
    currentDeal = { ...baseDeal };
    prisma = {
      deal: {
        findFirst: jest.fn().mockImplementation(() => Promise.resolve({ ...currentDeal })),
        update: jest.fn().mockImplementation(({ data }) => {
          currentDeal = { ...currentDeal, ...data };
          return Promise.resolve({ ...currentDeal });
        }),
        deleteMany: jest.fn(),
      },
      pipelineStage: { findFirst: jest.fn() },
      customer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      contract: { create: jest.fn().mockResolvedValue({ id: 'contract-1' }) },
      transaction: { create: jest.fn().mockResolvedValue({ id: 'transaction-1' }) },
      lead: { findUnique: jest.fn().mockResolvedValue(lead), findFirst: jest.fn() },
    };
    liroCrmService = { pushStageForDeal: jest.fn().mockResolvedValue(undefined) };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    realtimeService = { publish: jest.fn() };
    service = new DealsService(prisma, liroCrmService, auditService, realtimeService);
  });

  describe('close — GANHO', () => {
    it('cria cliente com os dados do lead, contrato (tem productPlan) e lançamento (valor > 0)', async () => {
      prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-ganho', isWon: true, isLost: false });

      await service.close('org-1', 'deal-1', { outcome: 'GANHO' } as any, 'user-1');

      expect(prisma.customer.create).toHaveBeenCalledTimes(1);
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: lead.name,
            phone: lead.phone,
            document: lead.document,
            dealId: 'deal-1',
            status: 'ATIVO',
          }),
        }),
      );

      expect(prisma.contract.create).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
      expect(prisma.transaction.create.mock.calls[0][0].data.amount).toBe(baseDeal.value);
    });

    it('não cria contrato quando o negócio não tem productPlan', async () => {
      currentDeal.productPlan = null;
      prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-ganho', isWon: true, isLost: false });

      await service.close('org-1', 'deal-1', { outcome: 'GANHO' } as any, 'user-1');

      expect(prisma.customer.create).toHaveBeenCalledTimes(1);
      expect(prisma.contract.create).not.toHaveBeenCalled();
    });

    it('não cria lançamento financeiro quando o valor é 0', async () => {
      currentDeal.value = 0;
      prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-ganho', isWon: true, isLost: false });

      await service.close('org-1', 'deal-1', { outcome: 'GANHO' } as any, 'user-1');

      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('é idempotente: se o cliente já existe (dealId já convertido), não cria de novo nem duplica contrato/lançamento', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'customer-ja-existente' });
      prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-ganho', isWon: true, isLost: false });

      await service.close('org-1', 'deal-1', { outcome: 'GANHO' } as any, 'user-1');

      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.contract.create).not.toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('close — PERDIDO', () => {
    it('marca como perdido com o motivo, sem criar cliente/contrato/lançamento nenhum', async () => {
      prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-perdido', isWon: false, isLost: true });

      await service.close('org-1', 'deal-1', { outcome: 'PERDIDO', lostReason: 'Escolheu concorrente' } as any, 'user-1');

      const updateCalls = prisma.deal.update.mock.calls;
      expect(updateCalls[0][0].data).toMatchObject({ status: 'PERDIDO', lostReason: 'Escolheu concorrente' });
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });
  });

  describe('move', () => {
    it('cair numa etapa marcada como isWon dispara o mesmo fluxo de markWon', async () => {
      prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-ganho', isWon: true, isLost: false });

      await service.move('org-1', 'deal-1', 'stage-ganho', 'user-1');

      expect(prisma.customer.create).toHaveBeenCalledTimes(1);
    });

    it('cair numa etapa marcada como isLost só muda o status, sem markWon', async () => {
      prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-perdido', isWon: false, isLost: true });

      await service.move('org-1', 'deal-1', 'stage-perdido', 'user-1');

      expect(prisma.customer.create).not.toHaveBeenCalled();
      const updateCalls = prisma.deal.update.mock.calls;
      expect(updateCalls.some((c: any) => c[0].data.status === 'PERDIDO')).toBe(true);
    });
  });
});
