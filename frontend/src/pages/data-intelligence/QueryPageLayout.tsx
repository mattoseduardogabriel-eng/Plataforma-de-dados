import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@/components/ui/primitives';
import { useDataQuery } from '@/hooks/useDataIntelligence';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import type { DataProviderResult } from '@/types';

export function QueryPageLayout({
  title,
  description,
  kind,
  fieldName,
  fieldLabel,
  fieldPlaceholder,
  renderResult,
}: {
  title: string;
  description: string;
  kind: 'cnpj' | 'cpf' | 'phone' | 'credit-score' | 'relatives';
  fieldName: 'document' | 'phone';
  fieldLabel: string;
  fieldPlaceholder: string;
  renderResult: (data: DataProviderResult) => ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const [value, setValue] = useState(searchParams.get('document') ?? '');
  const [purpose, setPurpose] = useState('');
  const mutation = useDataQuery(kind);
  const { toast } = useToast();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ [fieldName]: value, purpose } as any);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro na consulta', description: extractErrorMessage(err) });
    }
  };

  return (
    <div>
      <PageHeader title={title} description={description} />

      <Card>
        <CardHeader>
          <CardTitle>Nova consulta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>{fieldLabel}</Label>
              <Input required placeholder={fieldPlaceholder} value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div>
              <Label>Finalidade da consulta (obrigatória — LGPD)</Label>
              <Input required placeholder="Ex.: análise de crédito para novo contrato" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" loading={mutation.isPending}>
                <Search className="h-4 w-4" /> Consultar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {mutation.isError && (
        <Alert tone="danger" title="Falha na consulta" className="mt-4">
          {extractErrorMessage(mutation.error)}
        </Alert>
      )}

      {mutation.data && (
        <div className="mt-4">
          {mutation.data.isDemoData && (
            <Alert tone="warning" title="Dados de demonstração" className="mb-4">
              Este conector está em modo demonstração — os dados abaixo são sintéticos e não representam uma pessoa
              ou situação real. Para dados reais, contrate um provedor licenciado (Serasa Experian, Boa Vista SCPC,
              Big Data Corp, Assertiva) e configure o conector correspondente.
            </Alert>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
              <Badge tone={mutation.data.isDemoData ? 'warning' : 'success'}>
                {mutation.data.isDemoData ? 'Demonstração' : 'Dado oficial'} · {mutation.data.provider}
              </Badge>
            </CardHeader>
            <CardContent>{renderResult(mutation.data)}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-800">{value ?? '—'}</span>
    </div>
  );
}
