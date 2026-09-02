/** Catálogo de widgets do dashboard — usado pelo popover "Personalizar" pra
 * mostrar/esconder cada um (preferência pessoal, por usuário). */
export interface DashboardWidgetDef {
  key: string;
  label: string;
}

export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  { key: 'pipeline', label: 'Pipeline aberto' },
  { key: 'conversion', label: 'Taxa de conversão' },
  { key: 'received', label: 'Recebido este mês' },
  { key: 'churnRisk', label: 'Clientes em risco alto' },
  { key: 'goal', label: 'Meta x Produção' },
  { key: 'cashFlow', label: 'Gráfico de fluxo de caixa' },
  { key: 'funnel', label: 'Funil de vendas' },
  { key: 'activity', label: 'Atividade recente (auditoria)' },
];
