import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  KanbanSquare,
  Users2,
  Trophy,
  Wallet,
  Receipt,
  UserCog,
  Building2,
  ScanFace,
  Phone,
  Gauge,
  Users,
  ShieldCheck,
  FileSearch,
  ListChecks,
  ScrollText,
  Settings,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  // Chave da ferramenta (ver lib/platform-features.ts) — item some do menu
  // se a empresa/usuário não tiver essa ferramenta habilitada. Sem essa
  // chave, o item aparece sempre (ex.: Dashboard, Auditoria, Configurações).
  featureKey?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: 'Visão Geral',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    label: 'CRM de Vendas',
    items: [
      { label: 'Funil de Vendas', to: '/crm/funil', icon: KanbanSquare, featureKey: 'crm' },
      { label: 'Leads', to: '/crm/leads', icon: Users2, featureKey: 'crm' },
      { label: 'Equipe', to: '/crm/equipe', icon: Trophy, featureKey: 'crm' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { label: 'Fluxo de Caixa', to: '/financeiro', icon: Wallet, featureKey: 'financeiro' },
      { label: 'Lançamentos', to: '/financeiro/lancamentos', icon: Receipt, featureKey: 'financeiro' },
    ],
  },
  {
    label: 'Pós-venda',
    items: [{ label: 'Carteira de Clientes', to: '/pos-venda', icon: UserCog, featureKey: 'pos_venda' }],
  },
  {
    label: 'Inteligência de Dados',
    items: [
      { label: 'Consulta CNPJ', to: '/consultas/cnpj', icon: Building2, featureKey: 'consulta_cnpj' },
      { label: 'Consulta CPF', to: '/consultas/cpf', icon: ScanFace, featureKey: 'consulta_cpf' },
      { label: 'Consulta Telefone', to: '/consultas/telefone', icon: Phone, featureKey: 'consulta_telefone' },
      { label: 'Score de Crédito', to: '/consultas/credito', icon: Gauge, featureKey: 'consulta_credito' },
      { label: 'Vínculos/Parentes', to: '/consultas/parentes', icon: Users, featureKey: 'consulta_parentes' },
      { label: 'Histórico de Consultas', to: '/consultas/historico', icon: ListChecks },
    ],
  },
  {
    label: 'Crivo (Decisão de Crédito)',
    items: [
      { label: 'Avaliar Crédito', to: '/crivo', icon: ShieldCheck, featureKey: 'crivo' },
      { label: 'Políticas', to: '/crivo/politicas', icon: Settings, featureKey: 'crivo' },
    ],
  },
  {
    label: 'Cruzamento & Auditoria',
    items: [
      { label: 'Relatórios de Cruzamento', to: '/relatorios', icon: FileSearch, featureKey: 'relatorios_cruzamento' },
      { label: 'Log de Auditoria (LGPD)', to: '/auditoria', icon: ScrollText },
    ],
  },
  {
    label: 'Configurações',
    items: [{ label: 'Organização & Usuários', to: '/configuracoes', icon: Settings }],
  },
];
