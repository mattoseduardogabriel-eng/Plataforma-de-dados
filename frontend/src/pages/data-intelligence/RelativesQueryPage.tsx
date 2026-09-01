import { Badge } from '@/components/ui/primitives';
import { QueryPageLayout } from './QueryPageLayout';

export function RelativesQueryPage() {
  return (
    <QueryPageLayout
      title="Vínculos e Parentesco"
      description="Consulta sensível — exige provedor licenciado em produção. Modo demonstração ativo."
      kind="relatives"
      fieldName="document"
      fieldLabel="CPF"
      fieldPlaceholder="000.000.000-00"
      renderResult={(result) => {
        const d = result.data as any;
        return (
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-700">Vínculos simulados</p>
            <div className="space-y-2">
              {d.vinculosSimulados?.map((v: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{v.nomeSimulado}</p>
                    <p className="text-xs text-slate-400">{v.vinculo}</p>
                  </div>
                  {v.mesmoEnderecoSimulado && <Badge tone="info">Mesmo endereço (simulado)</Badge>}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">{d.aviso}</p>
          </div>
        );
      }}
    />
  );
}
