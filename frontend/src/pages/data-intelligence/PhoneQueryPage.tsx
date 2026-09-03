import { KeyValue, QueryPageLayout } from './QueryPageLayout';

export function PhoneQueryPage() {
  return (
    <QueryPageLayout
      title="Consulta de Telefone"
      description="UF derivada do DDD (dado público) — operadora e tipo simulados para demonstração"
      kind="phone"
      fieldName="phone"
      fieldLabel="Telefone (com DDD)"
      fieldPlaceholder="11987654321"
      renderResult={(result) => {
        const d = result.data as any;
        return (
          <div>
            <p className="mb-4 text-lg font-semibold text-slate-900">{d.telefone}</p>
            <KeyValue label="DDD" value={d.ddd} />
            <KeyValue label="UF (dado público)" value={d.ufSimulada} />
            <KeyValue label="Tipo (simulado)" value={d.tipoSimulado} />
            <KeyValue label="Operadora (simulada)" value={d.operadoraSimulada} />
            <p className="mt-3 text-xs text-slate-400">{d.aviso}</p>
          </div>
        );
      }}
    />
  );
}
