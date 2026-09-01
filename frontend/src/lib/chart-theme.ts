// Tokens de estilo para os gráficos Recharts — usam as mesmas variáveis CSS
// de tema (claro/escuro) definidas em src/index.css, então o tooltip e os
// eixos acompanham o tema atual automaticamente.
export const chartGridStroke = 'rgb(var(--slate-300) / 0.4)';
export const chartAxisStroke = 'rgb(var(--slate-500))';

export const chartTooltipStyle = {
  background: 'rgb(var(--slate-100))',
  border: '1px solid rgb(var(--slate-300) / 0.6)',
  borderRadius: 8,
  fontSize: 13,
  color: 'rgb(var(--slate-900))',
};
export const chartTooltipLabelStyle = { color: 'rgb(var(--slate-600))' };
export const chartTooltipItemStyle = { color: 'rgb(var(--slate-900))' };
