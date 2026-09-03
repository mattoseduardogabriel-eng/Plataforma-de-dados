import { Badge } from '@/components/ui/primitives';
import { QueryPageLayout, KeyValue } from './QueryPageLayout';

export function CpfQueryPage() {
  return (
    <QueryPageLayout
      title="Consulta de CPF"
      description="Validação de dígito verificador e dossiê de demonstração"
      kind="cpf"
      fieldName="document"
      fieldLabel="CPF"
      fieldPlaceholder="000.000.000-00"
      renderResult={(result) => {
        const d = result.data as any;
        return (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold text-slate-900">{d.cpf}</p>
              <Badge tone={d.cpfValido ? 'success' : 'danger'}>{d.cpfValido ? 'CPF válido' : 'CPF inválido'}</Badge>
            </div>
            <KeyValue label="Situação (simulada)" value={d.situacaoCadastralSimulada} />
            <KeyValue label="Nome (simulado)" value={d.nomeSimulado} />
            <KeyValue label="Faixa etária (simulada)" value={d.faixaEtariaSimulada} />
            <KeyValue label="Região (simulada)" value={d.regiaoSimulada} />
            <p className="mt-3 text-xs text-slate-400">{d.aviso}</p>
          </div>
        );
      }}
    />
  );
}
