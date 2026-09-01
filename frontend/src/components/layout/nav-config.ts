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
      { label: 'Funil de Vendas', to: '/crm/funil', icon: KanbanSquare },
      { label: 'Leads', to: '/crm/leads', icon: Users2 },
      { label: 'Equipe', to: '/crm/equipe', icon: Trophy },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { label: 'Fluxo de Caixa', to: '/financeiro', icon: Wallet },
      { label: 'Lançamentos', to: '/financeiro/lancamentos', icon: Receipt },
    ],
  },
  {
    label: 'Pós-venda',
    items: [{ label: 'Carteira de Clientes', to: '/pos-venda', icon: UserCog }],
  },
  {
    label: 'Inteligência de Dados',
    items: [
      { label: 'Consulta CNPJ', to: '/consultas/cnpj', icon: Building2 },
      { label: 'Consulta CPF', to: '/consultas/cpf', icon: ScanFace },
      { label: 'Consulta Telefone', to: '/consultas/telefone', icon: Phone },
      { label: 'Score de Crédito', to: '/consultas/credito', icon: Gauge },
      { label: 'Vínculos/Parentes', to: '/consultas/parentes', icon: Users },
      { label: 'Histórico de Consultas', to: '/consultas/historico', icon: ListChecks },
    ],
  },
  {
    label: 'Crivo (Decisão de Crédito)',
    items: [
      { label: 'Avaliar Crédito', to: '/crivo', icon: ShieldCheck },
      { label: 'Políticas', to: '/crivo/politicas', icon: Settings },
    ],
  },
  {
    label: 'Cruzamento & Auditoria',
    items: [
      { label: 'Relatórios de Cruzamento', to: '/relatorios', icon: FileSearch },
      { label: 'Log de Auditoria (LGPD)', to: '/auditoria', icon: ScrollText },
    ],
  },
  {
    label: 'Configurações',
    items: [{ label: 'Organização & Usuários', to: '/configuracoes', icon: Settings }],
  },
];
