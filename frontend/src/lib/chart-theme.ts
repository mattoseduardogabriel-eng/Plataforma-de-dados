// Tokens de estilo para os gráficos Recharts — usam as mesmas variáveis CSS
// de tema (claro/escuro) definidas em src/index.css, então o tooltip, os
// eixos e as cores de série acompanham o tema atual automaticamente.
//
// O trio de cores categóricas (receitas/despesas/saldo) foi validado com o
// script da skill de dataviz (contraste contra a superfície do Card e
// separação para daltonismo) — nunca trocar por hex "no olho".
export const chartGridStroke = 'rgb(var(--slate-300) / 0.4)';
export const chartAxisStroke = 'rgb(var(--slate-500))';
export const chartLegendTextColor = 'rgb(var(--slate-600))';

export const chartTooltipStyle = {
  background: 'rgb(var(--slate-100))',
  border: '1px solid rgb(var(--slate-300) / 0.6)',
  borderRadius: 8,
  fontSize: 13,
  color: 'rgb(var(--slate-900))',
};
export const chartTooltipLabelStyle = { color: 'rgb(var(--slate-600))' };
export const chartTooltipItemStyle = { color: 'rgb(var(--slate-900))' };
// Faixa vertical sutil que acompanha o mouse sobre o ponto ativo — ajuda a
// ler qual mês corresponde ao tooltip sem precisar mirar no eixo X.
export const chartCursorStyle = { stroke: 'rgb(var(--slate-400))', strokeWidth: 1, strokeDasharray: '3 3' };

export const chartSeriesColor = {
  receitas: 'rgb(var(--chart-receitas))',
  despesas: 'rgb(var(--chart-despesas))',
  saldo: 'rgb(var(--chart-saldo))',
};
