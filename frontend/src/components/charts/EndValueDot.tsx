/**
 * Marcador de linha do Recharts (>= 8px, anel na cor da superfície) que,
 * apenas no último ponto da série, também escreve o valor ao lado — "linha
 * termina com o valor", em vez de rotular cada ponto (o que viraria ruído).
 * Ver skill de dataviz: references/marks-and-anatomy.md.
 */
export function makeEndValueDot(color: string, totalPoints: number, formatValue: (v: number) => string) {
  return function EndValueDot(props: any) {
    const { cx, cy, index, value } = props;
    if (cx == null || cy == null) return <g key={index} />;
    const isLast = index === totalPoints - 1;
    // O `Area` do Recharts passa `value` como [base, topo] (faixa da área,
    // não um número) — o `Line` passa o número puro. Cobre os dois.
    const numericValue = Array.isArray(value) ? value[1] : value;
    return (
      <g key={index}>
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="rgb(var(--slate-100))" strokeWidth={2} />
        {isLast && (
          // Cor do texto vem de um token de tinta (nunca a cor da série) — a
          // identidade já está no ponto colorido ao lado. text-anchor start
          // porque é o último ponto da linha (extremidade direita do gráfico).
          <text x={cx + 8} y={cy} dy={4} fontSize={12} fontWeight={600} fill="rgb(var(--slate-800))">
            {formatValue(numericValue)}
          </text>
        )}
      </g>
    );
  };
}
