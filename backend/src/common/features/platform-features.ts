/**
 * Catálogo de "ferramentas" da plataforma que podem ser ligadas/desligadas
 * em dois níveis:
 *  1. Dono da plataforma (SUPER_ADMIN, via backoffice) define o TETO — quais
 *     ferramentas aquela empresa contratou/tem direito de usar.
 *  2. Dentro desse teto, o ADMIN/GESTOR da própria empresa pode desligar
 *     ferramentas específicas por setor ou por usuário individual (nunca
 *     religar uma que o dono da plataforma bloqueou).
 *
 * Adicionar uma ferramenta nova aqui é o único lugar que precisa mudar pra
 * ela aparecer nas telas de configuração (backoffice e da própria empresa);
 * o controller correspondente ainda precisa ser decorado com
 * `@RequireFeature('chave')`.
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

export const ALL_FEATURE_KEYS = PLATFORM_FEATURES.map((f) => f.key);

export function isValidFeatureKey(key: string): boolean {
  return ALL_FEATURE_KEYS.includes(key);
}
