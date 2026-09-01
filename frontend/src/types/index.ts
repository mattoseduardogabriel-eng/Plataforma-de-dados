export type Role = 'ADMIN' | 'GESTOR' | 'VENDEDOR' | 'FINANCEIRO' | 'ATENDIMENTO' | 'ANALISTA';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active?: boolean;
  organizationId?: string;
  createdAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  cnpj?: string | null;
}

// ── CRM ─────────────────────────────────────────────────────────────────
export type LeadStatus = 'NOVO' | 'QUALIFICANDO' | 'DESCARTADO' | 'CONVERTIDO';
export type DocumentType = 'CPF' | 'CNPJ';
export type DealStatus = 'ABERTO' | 'GANHO' | 'PERDIDO';
export type ActivityType = 'LIGACAO' | 'REUNIAO' | 'EMAIL' | 'PROPOSTA' | 'TAREFA' | 'NOTA';

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  colorHex: string;
  isWon: boolean;
  isLost: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
}

export interface Lead {
  id: string;
  name: string;
  document?: string | null;
  documentType?: DocumentType | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  source?: string | null;
  status: LeadStatus;
  liroContactId?: string | null;
  liroOperatorName?: string | null;
  assignedTo?: { id: string; name: string } | null;
  sectorId?: string | null;
  sector?: { id: string; name: string } | null;
  additionalAssignees?: { userId: string; user: { id: string; name: string } }[];
  createdAt: string;
}

export interface Deal {
  id: string;
  title: string;
  value: string | number;
  productPlan?: string | null;
  status: DealStatus;
  lostReason?: string | null;
  stage: PipelineStage;
  stageId: string;
  pipelineId: string;
  owner: { id: string; name: string };
  lead?: { id: string; name: string; document?: string | null; documentType?: DocumentType | null } | null;
  expectedCloseDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  doneAt?: string | null;
  assignedTo?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CrmFunnelStage {
  stageId: string;
  stageName: string;
  colorHex: string;
  count: number;
  totalValue: number;
}

export interface CrmOverview {
  open: { count: number; totalValue: number };
  won: { count: number; totalValue: number };
  lost: { count: number; totalValue: number };
  conversionRate: number;
  funnel: CrmFunnelStage[];
}

export interface TeamPerformance {
  userId: string;
  name: string;
  role: Role;
  dealsWon: number;
  revenueWon: number;
  openDeals: number;
  openPipelineValue: number;
  activitiesDone: number;
  activitiesPending: number;
}

// ── Financeiro ──────────────────────────────────────────────────────────
export type FinanceType = 'RECEITA' | 'DESPESA';
export type TransactionStatus = 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO';

export interface Category {
  id: string;
  name: string;
  type: FinanceType;
}

export interface Transaction {
  id: string;
  type: FinanceType;
  description: string;
  amount: string | number;
  dueDate: string;
  paidAt?: string | null;
  status: TransactionStatus;
  category?: Category | null;
  customer?: { id: string; name: string } | null;
}

export interface CashFlowPoint {
  month: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

export interface CashFlowSummary {
  pendingReceivablesTotal: number;
  pendingReceivablesCount: number;
  overdueCount: number;
  paidThisMonthTotal: number;
}

// ── Pós-venda ───────────────────────────────────────────────────────────
export type CustomerStatus = 'ATIVO' | 'INATIVO' | 'SUSPENSO' | 'CANCELADO';
export type ChurnRiskLevel = 'BAIXO' | 'MEDIO' | 'ALTO';
export type InteractionType = 'LIGACAO' | 'EMAIL' | 'CHAT' | 'VISITA' | 'RECLAMACAO' | 'ELOGIO';

export interface Customer {
  id: string;
  name: string;
  document?: string | null;
  documentType?: DocumentType | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  planName?: string | null;
  monthlyValue?: string | number | null;
  contractStartDate?: string | null;
  status: CustomerStatus;
  churnRiskScore?: number | null;
  churnRiskLevel?: ChurnRiskLevel | null;
  customFields?: Record<string, string | boolean>;
  createdAt: string;
}

export type CustomFieldType = 'TEXTO' | 'BOOLEANO' | 'LISTA';

export interface CustomerFieldDefinition {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  order: number;
}

export interface Contract {
  id: string;
  planName: string;
  value: string | number;
  startDate: string;
  endDate?: string | null;
  status: 'ATIVO' | 'ENCERRADO' | 'RENOVADO';
}

export interface InteractionHistory {
  id: string;
  type: InteractionType;
  summary: string;
  notes?: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface ChurnSignal {
  id: string;
  signalType: string;
  weight: number;
  notes?: string | null;
  createdAt: string;
}

export interface PortfolioOverview {
  byStatus: { status: CustomerStatus; count: number }[];
  byRisk: { level: string; count: number }[];
  monthlyRecurringRevenue: number;
}

// ── Inteligência de dados ──────────────────────────────────────────────
export type DataQueryType = 'CNPJ' | 'CPF' | 'TELEFONE' | 'CREDITO' | 'PARENTES';

export interface DataProviderResult<T = Record<string, unknown>> {
  provider: string;
  isDemoData: boolean;
  data: T;
}

export interface DataQueryHistoryItem {
  id: string;
  type: DataQueryType;
  targetDocument: string;
  purpose: string;
  provider: string;
  isDemoData: boolean;
  resultJson: unknown;
  createdAt: string;
  requestedBy: { id: string; name: string };
}

// ── Crivo ───────────────────────────────────────────────────────────────
export type CrivoOutcome = 'APROVADO' | 'REPROVADO' | 'ANALISE_MANUAL';
export type ReportTargetType = 'CNPJ' | 'CPF';

export interface CrivoReason {
  criterio: string;
  resultado: 'OK' | 'ALERTA' | 'BLOQUEIO';
  detalhe: string;
}

export interface CreditPolicy {
  id: string;
  name: string;
  active: boolean;
  isDefault: boolean;
  minScoreApproved: number;
  minScoreManualReview: number;
  maxPendenciasAllowed: number;
  blockIfCnpjInativa: boolean;
  flagIfChurnRiskAlto: boolean;
  creditLimitPerScorePoint: string | number;
  maxCreditLimit: string | number;
}

export interface CrivoDecision {
  id: string;
  targetDocument: string;
  targetType: ReportTargetType;
  outcome: CrivoOutcome;
  scoreUsed?: number | null;
  suggestedCreditLimit?: string | number | null;
  reasons: CrivoReason[];
  purpose: string;
  requestedBy?: { id: string; name: string };
  policy?: { id: string; name: string } | null;
  createdAt: string;
}

// ── Relatórios / Auditoria ─────────────────────────────────────────────
export interface Report {
  id: string;
  title: string;
  targetDocument: string;
  targetType: ReportTargetType;
  summaryJson: any;
  createdBy?: { id: string; name: string };
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  purpose?: string | null;
  metadata?: unknown;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

// ── Integrações ─────────────────────────────────────────────────────────
export type LiroCrmStatus =
  | { configured: false }
  | { configured: true; baseUrl: string; apiKeySuffix: string; lastSyncedAt: string | null };

export interface LiroCrmSyncResult {
  created: number;
  updated: number;
  total: number;
}

export const PERSONAL_DATA_PROVIDERS = [
  'SERASA',
  'BOA_VISTA',
  'BIG_DATA_CORP',
  'ASSERTIVA',
  'QUOD',
  'GENERICO',
] as const;
export type PersonalDataProviderName = (typeof PERSONAL_DATA_PROVIDERS)[number];

export type PersonalDataProviderStatus =
  | { configured: false }
  | {
      configured: true;
      provider: PersonalDataProviderName;
      baseUrl: string;
      apiKeySuffix: string;
      cpfConfigured: boolean;
      phoneConfigured: boolean;
      creditScoreConfigured: boolean;
      relativesConfigured: boolean;
      updatedAt: string;
    };

export interface SavePersonalDataProviderPayload {
  provider: PersonalDataProviderName;
  baseUrl: string;
  apiKey: string;
  authHeaderName?: string;
  authScheme?: string;
  cpfPath?: string;
  phonePath?: string;
  creditScorePath?: string;
  relativesPath?: string;
}
