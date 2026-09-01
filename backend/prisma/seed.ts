import { PrismaClient, Role, DocumentType, LeadStatus, DealStatus, FinanceType, TransactionStatus, InteractionType, CustomerStatus, DataQueryType, ReportTargetType, CrivoOutcome, type Lead } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_ORG_NAME = 'Franquia Demo Telecom';
const DEMO_PASSWORD = 'Demo@123456';

async function hash(password: string) {
  return bcrypt.hash(password, 10);
}

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function monthsAgo(months: number, day = 5) {
  const d = new Date();
  d.setMonth(d.getMonth() - months, day);
  return d;
}

async function main() {
  console.log('🌱 Iniciando seed de demonstração...');

  const existing = await prisma.organization.findFirst({ where: { name: DEMO_ORG_NAME } });
  if (existing) {
    console.log('♻️  Removendo dados de demonstração anteriores...');
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  const passwordHash = await hash(DEMO_PASSWORD);

  const org = await prisma.organization.create({
    data: { name: DEMO_ORG_NAME, cnpj: '12.345.678/0001-90' },
  });

  const [admin, gestor, vendedor1, vendedor2, financeiro, atendimento, analista] = await Promise.all([
    prisma.user.create({ data: { organizationId: org.id, name: 'Ana Souza', email: 'admin@franquiademo.com.br', passwordHash, role: Role.ADMIN } }),
    prisma.user.create({ data: { organizationId: org.id, name: 'Roberto Lima', email: 'gestor@franquiademo.com.br', passwordHash, role: Role.GESTOR } }),
    prisma.user.create({ data: { organizationId: org.id, name: 'Carla Nunes', email: 'carla@franquiademo.com.br', passwordHash, role: Role.VENDEDOR } }),
    prisma.user.create({ data: { organizationId: org.id, name: 'Diego Faria', email: 'diego@franquiademo.com.br', passwordHash, role: Role.VENDEDOR } }),
    prisma.user.create({ data: { organizationId: org.id, name: 'Fernanda Costa', email: 'financeiro@franquiademo.com.br', passwordHash, role: Role.FINANCEIRO } }),
    prisma.user.create({ data: { organizationId: org.id, name: 'Juliana Prado', email: 'atendimento@franquiademo.com.br', passwordHash, role: Role.ATENDIMENTO } }),
    prisma.user.create({ data: { organizationId: org.id, name: 'Marcos Vidal', email: 'analista@franquiademo.com.br', passwordHash, role: Role.ANALISTA } }),
  ]);

  const pipeline = await prisma.pipeline.create({
    data: {
      organizationId: org.id,
      name: 'Funil de Vendas',
      isDefault: true,
      stages: {
        create: [
          { name: 'Novo Contato', order: 1, colorHex: '#94a3b8' },
          { name: 'Qualificação', order: 2, colorHex: '#38bdf8' },
          { name: 'Proposta Enviada', order: 3, colorHex: '#a78bfa' },
          { name: 'Negociação', order: 4, colorHex: '#fbbf24' },
          { name: 'Fechado — Ganho', order: 5, colorHex: '#22c55e', isWon: true },
          { name: 'Fechado — Perdido', order: 6, colorHex: '#ef4444', isLost: true },
        ],
      },
    },
    include: { stages: true },
  });
  const stage = (name: string) => pipeline.stages.find((s) => s.name === name)!;

  await prisma.creditPolicy.create({
    data: { organizationId: org.id, name: 'Política Padrão', active: true, isDefault: true },
  });

  // ── Leads ────────────────────────────────────────────────────────────
  const leadsData = [
    { name: 'Padaria Pão Quente Ltda', document: '19131243000197', documentType: DocumentType.CNPJ, companyName: 'Padaria Pão Quente', email: 'contato@paoquente.com.br', phone: '11987650001', source: 'Indicação', status: LeadStatus.QUALIFICANDO, assignedTo: vendedor1 },
    { name: 'Mercado Bom Preço EIRELI', document: '11444777000161', documentType: DocumentType.CNPJ, companyName: 'Mercado Bom Preço', email: 'financeiro@bompreco.com.br', phone: '11987650002', source: 'Site', status: LeadStatus.NOVO, assignedTo: vendedor2 },
    { name: 'Clínica Vida Saudável', document: '45723174000110', documentType: DocumentType.CNPJ, companyName: 'Clínica Vida Saudável', email: 'adm@vidasaudavel.com.br', phone: '11987650003', source: 'Evento', status: LeadStatus.QUALIFICANDO, assignedTo: vendedor1 },
    { name: 'Auto Peças Rodavia', document: '05285180000117', documentType: DocumentType.CNPJ, companyName: 'Auto Peças Rodavia', email: 'compras@rodavia.com.br', phone: '11987650004', source: 'Indicação', status: LeadStatus.NOVO, assignedTo: vendedor2 },
    { name: 'Estúdio Criativo Design', document: '52998224725', documentType: DocumentType.CPF, companyName: null, email: 'contato@estudiocriativo.com.br', phone: '11987650005', source: 'Redes sociais', status: LeadStatus.DESCARTADO, assignedTo: vendedor1 },
    { name: 'Escritório Contábil Confiança', document: '86155459000102', documentType: DocumentType.CNPJ, companyName: 'Contábil Confiança', email: 'contato@confiancacontabil.com.br', phone: '11987650006', source: 'Indicação', status: LeadStatus.CONVERTIDO, assignedTo: vendedor2 },
    { name: 'Pizzaria Forno de Ouro', document: '71958301000191', documentType: DocumentType.CNPJ, companyName: 'Pizzaria Forno de Ouro', email: 'gerencia@fornodeouro.com.br', phone: '11987650007', source: 'Site', status: LeadStatus.CONVERTIDO, assignedTo: vendedor1 },
    { name: 'Academia Corpo em Forma', document: '33417393000178', documentType: DocumentType.CNPJ, companyName: 'Academia Corpo em Forma', email: 'adm@corpoemforma.com.br', phone: '11987650008', source: 'Evento', status: LeadStatus.QUALIFICANDO, assignedTo: vendedor2 },
  ];

  const leads: Lead[] = [];
  for (const l of leadsData) {
    const lead = await prisma.lead.create({
      data: {
        organizationId: org.id,
        name: l.name,
        document: l.document,
        documentType: l.documentType,
        email: l.email,
        phone: l.phone,
        companyName: l.companyName,
        source: l.source,
        status: l.status,
        assignedToId: l.assignedTo.id,
        createdById: admin.id,
        createdAt: daysAgo(Math.floor(Math.random() * 60) + 5),
      },
    });
    leads.push(lead);
  }

  // ── Deals ────────────────────────────────────────────────────────────
  const plans = ['Internet Empresarial 300Mb', 'Internet Empresarial 500Mb', 'Link Dedicado 100Mb', 'Combo Internet + Telefonia', 'Internet Empresarial 1Gb'];

  const dealSpecs = [
    { lead: leads[0], stage: stage('Qualificação'), value: 349.9, owner: vendedor1, status: DealStatus.ABERTO },
    { lead: leads[1], stage: stage('Novo Contato'), value: 249.9, owner: vendedor2, status: DealStatus.ABERTO },
    { lead: leads[2], stage: stage('Proposta Enviada'), value: 599.9, owner: vendedor1, status: DealStatus.ABERTO },
    { lead: leads[3], stage: stage('Novo Contato'), value: 299.9, owner: vendedor2, status: DealStatus.ABERTO },
    { lead: leads[4], stage: stage('Fechado — Perdido'), value: 199.9, owner: vendedor1, status: DealStatus.PERDIDO, lostReason: 'Optou por concorrente com preço menor' },
    { lead: leads[5], stage: stage('Fechado — Ganho'), value: 449.9, owner: vendedor2, status: DealStatus.GANHO },
    { lead: leads[6], stage: stage('Fechado — Ganho'), value: 349.9, owner: vendedor1, status: DealStatus.GANHO },
    { lead: leads[7], stage: stage('Negociação'), value: 799.9, owner: vendedor2, status: DealStatus.ABERTO },
  ];

  for (const [idx, d] of dealSpecs.entries()) {
    const deal = await prisma.deal.create({
      data: {
        organizationId: org.id,
        leadId: d.lead.id,
        pipelineId: pipeline.id,
        stageId: d.stage.id,
        title: `${plans[idx % plans.length]} — ${d.lead.name}`,
        productPlan: plans[idx % plans.length],
        value: d.value,
        ownerId: d.owner.id,
        status: d.status,
        lostReason: (d as any).lostReason,
        expectedCloseDate: daysAgo(-15),
        closedAt: d.status !== DealStatus.ABERTO ? daysAgo(Math.floor(Math.random() * 20)) : null,
        createdAt: daysAgo(Math.floor(Math.random() * 50) + 10),
      },
    });

    await prisma.activity.create({
      data: {
        organizationId: org.id,
        dealId: deal.id,
        leadId: d.lead.id,
        type: 'LIGACAO',
        title: 'Primeiro contato comercial',
        notes: 'Cliente demonstrou interesse no plano empresarial.',
        createdById: d.owner.id,
        assignedToId: d.owner.id,
        doneAt: daysAgo(Math.floor(Math.random() * 40) + 5),
      },
    });

    if (d.status === DealStatus.GANHO) {
      const customer = await prisma.customer.create({
        data: {
          organizationId: org.id,
          name: d.lead.name,
          document: d.lead.document,
          documentType: d.lead.documentType,
          email: d.lead.email,
          phone: d.lead.phone,
          planName: plans[idx % plans.length],
          monthlyValue: d.value,
          contractStartDate: daysAgo(Math.floor(Math.random() * 60) + 10),
          status: CustomerStatus.ATIVO,
          dealId: deal.id,
        },
      });

      await prisma.contract.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          planName: plans[idx % plans.length],
          value: d.value,
          startDate: customer.contractStartDate!,
          status: 'ATIVO',
        },
      });

      await prisma.interactionHistory.create({
        data: {
          organizationId: org.id,
          customerId: customer.id,
          type: InteractionType.LIGACAO,
          summary: 'Ligação de boas-vindas pós-instalação',
          createdById: atendimento.id,
          createdAt: daysAgo(Math.floor(Math.random() * 20)),
        },
      });
    }
  }

  // Cliente adicional já com sinais de risco de churn, para popular o dashboard
  const riskyCustomer = await prisma.customer.create({
    data: {
      organizationId: org.id,
      name: 'Restaurante Sabor Caseiro',
      document: '27865757000102',
      documentType: DocumentType.CNPJ,
      email: 'financeiro@saborcaseiro.com.br',
      phone: '11987650099',
      planName: 'Internet Empresarial 300Mb',
      monthlyValue: 299.9,
      contractStartDate: monthsAgo(8),
      status: CustomerStatus.ATIVO,
    },
  });
  await prisma.contract.create({
    data: { organizationId: org.id, customerId: riskyCustomer.id, planName: 'Internet Empresarial 300Mb', value: 299.9, startDate: monthsAgo(8), status: 'ATIVO' },
  });
  await prisma.interactionHistory.createMany({
    data: [
      { organizationId: org.id, customerId: riskyCustomer.id, type: InteractionType.RECLAMACAO, summary: 'Instabilidade no link há 3 dias', createdById: atendimento.id, createdAt: daysAgo(6) },
      { organizationId: org.id, customerId: riskyCustomer.id, type: InteractionType.LIGACAO, summary: 'Cliente ameaçou cancelar o contrato', createdById: atendimento.id, createdAt: daysAgo(3) },
    ],
  });
  await prisma.churnSignal.createMany({
    data: [
      { organizationId: org.id, customerId: riskyCustomer.id, signalType: 'RECLAMACAO', weight: 2, notes: 'Instabilidade no link', createdAt: daysAgo(6) },
      { organizationId: org.id, customerId: riskyCustomer.id, signalType: 'ATRASO_PAGAMENTO', weight: 2, notes: 'Fatura em atraso há 15 dias', createdAt: daysAgo(4) },
      { organizationId: org.id, customerId: riskyCustomer.id, signalType: 'CANCELAMENTO_SOLICITADO', weight: 3, notes: 'Solicitou orçamento de cancelamento', createdAt: daysAgo(2) },
    ],
  });
  const riskyTotalWeight = 2 + 2 + 3;
  const riskyScore = Math.min(100, riskyTotalWeight * 10);
  await prisma.customer.update({
    where: { id: riskyCustomer.id },
    data: { churnRiskScore: riskyScore, churnRiskLevel: riskyScore >= 60 ? 'ALTO' : riskyScore >= 25 ? 'MEDIO' : 'BAIXO' },
  });

  // ── Financeiro ───────────────────────────────────────────────────────
  const receitaCategory = await prisma.category.create({ data: { organizationId: org.id, name: 'Mensalidades de Clientes', type: FinanceType.RECEITA } });
  const setupCategory = await prisma.category.create({ data: { organizationId: org.id, name: 'Taxas de Instalação', type: FinanceType.RECEITA } });
  const folhaCategory = await prisma.category.create({ data: { organizationId: org.id, name: 'Folha de Pagamento', type: FinanceType.DESPESA } });
  const infraCategory = await prisma.category.create({ data: { organizationId: org.id, name: 'Infraestrutura e Link', type: FinanceType.DESPESA } });
  const marketingCategory = await prisma.category.create({ data: { organizationId: org.id, name: 'Marketing', type: FinanceType.DESPESA } });

  const customers = await prisma.customer.findMany({ where: { organizationId: org.id } });

  for (let m = 5; m >= 0; m -= 1) {
    for (const customer of customers) {
      const due = monthsAgo(m, 10);
      const isPast = due < new Date();
      const status = !isPast ? TransactionStatus.PENDENTE : Math.random() > 0.15 ? TransactionStatus.PAGO : TransactionStatus.ATRASADO;
      await prisma.transaction.create({
        data: {
          organizationId: org.id,
          categoryId: receitaCategory.id,
          type: FinanceType.RECEITA,
          description: `Mensalidade — ${customer.name}`,
          amount: customer.monthlyValue ?? 299.9,
          dueDate: due,
          paidAt: status === TransactionStatus.PAGO ? due : null,
          status,
          customerId: customer.id,
          createdById: financeiro.id,
        },
      });
    }
    await prisma.transaction.create({
      data: { organizationId: org.id, categoryId: folhaCategory.id, type: FinanceType.DESPESA, description: 'Folha de pagamento', amount: 3200, dueDate: monthsAgo(m, 5), paidAt: monthsAgo(m, 5), status: TransactionStatus.PAGO, createdById: financeiro.id },
    });
    await prisma.transaction.create({
      data: { organizationId: org.id, categoryId: infraCategory.id, type: FinanceType.DESPESA, description: 'Link dedicado / backbone', amount: 980, dueDate: monthsAgo(m, 8), paidAt: monthsAgo(m, 8), status: TransactionStatus.PAGO, createdById: financeiro.id },
    });
    await prisma.transaction.create({
      data: { organizationId: org.id, categoryId: marketingCategory.id, type: FinanceType.DESPESA, description: 'Campanhas de marketing local', amount: 350, dueDate: monthsAgo(m, 12), paidAt: monthsAgo(m, 12), status: TransactionStatus.PAGO, createdById: financeiro.id },
    });
  }
  await prisma.transaction.create({
    data: { organizationId: org.id, categoryId: setupCategory.id, type: FinanceType.RECEITA, description: 'Taxa de instalação — novos clientes', amount: 890, dueDate: daysAgo(10), paidAt: daysAgo(10), status: TransactionStatus.PAGO, createdById: financeiro.id },
  });

  // ── Inteligência de dados: histórico de consultas + auditoria ─────────
  async function logQuery(type: DataQueryType, targetDocument: string, purpose: string, provider: string, isDemoData: boolean, resultJson: object, requestedBy = admin, when = daysAgo(1)) {
    await prisma.dataQuery.create({
      data: { organizationId: org.id, requestedById: requestedBy.id, type, targetDocument, purpose, provider, isDemoData, resultJson, createdAt: when },
    });
    await prisma.auditLog.create({
      data: { organizationId: org.id, userId: requestedBy.id, action: `DATA_QUERY_${type}`, entityType: 'DataQuery', entityId: targetDocument, purpose, metadata: { provider, isDemoData }, createdAt: when },
    });
  }

  await logQuery(DataQueryType.CNPJ, '19131243000197', 'Análise de crédito para plano empresarial', 'brasilapi', false, {
    cnpj: '19131243000197', razaoSocial: 'OPEN KNOWLEDGE BRASIL', nomeFantasia: 'REDE PELO CONHECIMENTO LIVRE', situacaoCadastral: 'ATIVA',
  }, vendedor1, daysAgo(2));
  await logQuery(DataQueryType.CPF, '52998224725', 'KYC cadastral de novo lead', 'mock-demo', true, {
    cpf: '529.982.247-25', cpfValido: true, situacaoCadastralSimulada: 'REGULAR',
  }, vendedor2, daysAgo(3));
  await logQuery(DataQueryType.CREDITO, '52998224725', 'Aprovação de crédito para contratação', 'mock-demo', true, {
    scoreSimulado: 742, faixaSimulada: 'BAIXO RISCO',
  }, admin, daysAgo(3));
  await logQuery(DataQueryType.TELEFONE, '11987650001', 'Confirmação de contato antes de proposta', 'mock-demo', true, {
    ddd: '11', ufSimulada: 'SP', tipoSimulado: 'MÓVEL',
  }, vendedor1, daysAgo(4));
  await logQuery(DataQueryType.PARENTES, '52998224725', 'Prevenção a fraude — due diligence', 'mock-demo', true, {
    vinculosSimulados: [{ vinculo: 'Cônjuge', nomeSimulado: 'Vínculo Demonstrativo A' }],
  }, analista, daysAgo(5));

  await prisma.report.create({
    data: {
      organizationId: org.id,
      title: 'Cruzamento — 19131243000197',
      targetDocument: '19131243000197',
      targetType: ReportTargetType.CNPJ,
      summaryJson: { internal: { leads: 1, customers: 0 }, external: { cnpj: { situacaoCadastral: 'ATIVA' } } },
      createdById: admin.id,
      createdAt: daysAgo(2),
    },
  });

  const policy = await prisma.creditPolicy.findFirstOrThrow({ where: { organizationId: org.id, isDefault: true } });
  await prisma.crivoDecision.create({
    data: {
      organizationId: org.id,
      policyId: policy.id,
      targetDocument: '19131243000197',
      targetType: ReportTargetType.CNPJ,
      outcome: CrivoOutcome.APROVADO,
      scoreUsed: 831,
      suggestedCreditLimit: 8310,
      reasons: [
        { criterio: 'Situação cadastral do CNPJ', resultado: 'OK', detalhe: 'Situação atual: ATIVA.' },
        { criterio: 'Score de crédito', resultado: 'OK', detalhe: 'Score simulado: 831/1000 (BAIXO RISCO).' },
        { criterio: 'Pendências financeiras', resultado: 'OK', detalhe: '0 pendência(s) — dentro do limite.' },
      ],
      purpose: 'Aprovação de crédito para plano empresarial',
      requestedById: admin.id,
      createdAt: daysAgo(2),
    },
  });

  await prisma.auditLog.create({
    data: { organizationId: org.id, userId: admin.id, action: 'REGISTER_ORGANIZATION', entityType: 'Organization', entityId: org.id, createdAt: daysAgo(90) },
  });

  console.log('✅ Seed concluído.');
  console.log('');
  console.log('Organização demo:', DEMO_ORG_NAME);
  console.log('Login (qualquer usuário abaixo) — senha:', DEMO_PASSWORD);
  for (const u of [admin, gestor, vendedor1, vendedor2, financeiro, atendimento, analista]) {
    console.log(`  · ${u.role.padEnd(10)} ${u.email}`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Erro ao rodar o seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
