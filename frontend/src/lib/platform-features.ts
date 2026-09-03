/**
 * Espelha `backend/src/common/features/platform-features.ts` — mesma
 * lista de chaves, pra montar os checkboxes de habilitar/desabilitar
 * ferramenta no backoffice e nas telas de configuração da empresa.
 */
export interface PlatformFeatureDef {
  key: string;
  label: string;
  group: string;
}

export const PLATFORM_FEATURES: PlatformFeatureDef[] = [
  { key: 'crm', label: 'CRM de Vendas (funil, leads, equipe)', group: 'CRM' },
  { key: 'financeiro', label: 'Financeiro (fluxo de caixa, lançamentos)', group: 'Financeiro' },
  { key: 'pos_venda', label: 'Pós-venda (carteira de clientes)', group: 'Pós-venda' },
  { key: 'consulta_cnpj', label: 'Consulta de CNPJ', group: 'Inteligência de Dados' },
  { key: 'consulta_cpf', label: 'Consulta de CPF', group: 'Inteligência de Dados' },
  { key: 'consulta_telefone', label: 'Consulta de Telefone', group: 'Inteligência de Dados' },
  { key: 'consulta_credito', label: 'Score de Crédito', group: 'Inteligência de Dados' },
  { key: 'consulta_parentes', label: 'Vínculos/Parentes', group: 'Inteligência de Dados' },
  { key: 'crivo', label: 'Crivo (decisão de crédito)', group: 'Crivo' },
  { key: 'relatorios_cruzamento', label: 'Relatórios de Cruzamento', group: 'Cruzamento & Auditoria' },
  { key: 'integracao_liro_crm', label: 'Integração com o Liro CRM', group: 'Integrações' },
];
