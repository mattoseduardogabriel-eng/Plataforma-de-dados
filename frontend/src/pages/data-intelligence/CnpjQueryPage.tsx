import { Badge } from '@/components/ui/primitives';
import { QueryPageLayout, KeyValue } from './QueryPageLayout';
import { formatCurrency, formatDate, formatDocument } from '@/lib/utils';

export function CnpjQueryPage() {
  return (
    <QueryPageLayout
      title="Consulta de CNPJ"
      description="Situação cadastral, sócios e CNAE — dado oficial público via BrasilAPI/Receita Federal"
      kind="cnpj"
      fieldName="document"
      fieldLabel="CNPJ"
      fieldPlaceholder="00.000.000/0000-00"
      renderResult={(result) => {
        const d = result.data as any;
        const ativa = d.situacaoCadastral?.toUpperCase() === 'ATIVA';
        return (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-slate-900">{d.razaoSocial}</p>
                {d.nomeFantasia && <p className="text-sm text-slate-500">{d.nomeFantasia}</p>}
              </div>
              <Badge tone={ativa ? 'success' : 'danger'}>{d.situacaoCadastral}</Badge>
            </div>
            <KeyValue label="CNPJ" value={formatDocument(d.cnpj)} />
            <KeyValue label="Natureza jurídica" value={d.naturezaJuridica} />
            <KeyValue label="Início de atividade" value={formatDate(d.dataInicioAtividade)} />
            <KeyValue label="Situação desde" value={formatDate(d.dataSituacaoCadastral)} />
            <KeyValue label="CNAE principal" value={`${d.cnaePrincipal?.codigo} — ${d.cnaePrincipal?.descricao}`} />
            <KeyValue label="Porte" value={d.porte} />
            <KeyValue label="Capital social" value={formatCurrency(d.capitalSocial)} />
            <KeyValue
              label="Endereço"
              value={[d.endereco?.logradouro, d.endereco?.numero, d.endereco?.bairro, d.endereco?.municipio, d.endereco?.uf]
                .filter(Boolean)
                .join(', ')}
            />
            {d.socios?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">Quadro societário</p>
                <div className="space-y-1">
                  {d.socios.map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span>{s.nome}</span>
                      <span className="text-slate-400">{s.qualificacao}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
