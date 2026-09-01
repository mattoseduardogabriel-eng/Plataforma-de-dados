import { Badge } from '@/components/ui/primitives';
import { KeyValue, QueryPageLayout } from './QueryPageLayout';
import { cn } from '@/lib/utils';

const FAIXA_TONE: Record<string, 'danger' | 'warning' | 'info' | 'success'> = {
  'ALTO RISCO': 'danger',
  'RISCO MÉDIO': 'warning',
  'BAIXO RISCO': 'info',
  EXCELENTE: 'success',
};

export function CreditScoreQueryPage() {
  return (
    <QueryPageLayout
      title="Score de Crédito"
      description="Score sintético (0–1000) para análise de risco — conector plugável para bureau real"
      kind="credit-score"
      fieldName="document"
      fieldLabel="CPF ou CNPJ"
      fieldPlaceholder="Documento a analisar"
      renderResult={(result) => {
        const d = result.data as any;
        const pct = Math.min(100, (d.scoreSimulado / 1000) * 100);
        return (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-3xl font-semibold text-slate-900">{d.scoreSimulado}/1000</p>
              <Badge tone={FAIXA_TONE[d.faixaSimulada] ?? 'neutral'}>{d.faixaSimulada}</Badge>
            </div>
            <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full',
                  pct < 30 ? 'bg-red-500' : pct < 60 ? 'bg-amber-500' : pct < 85 ? 'bg-sky-500' : 'bg-emerald-500',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <KeyValue label="Pendências (simuladas)" value={d.pendenciasSimuladas} />
            <KeyValue label="Recomendação" value={d.recomendacaoSimulada} />
            <p className="mt-3 text-xs text-slate-400">{d.aviso}</p>
          </div>
        );
      }}
    />
  );
}
