import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Spinner, EmptyState } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { usePolicies, useEvaluateCrivo, useCrivoDecisions } from '@/hooks/useCrivo';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatCurrency, formatDateTime, formatDocument } from '@/lib/utils';
import type { CrivoOutcome, ReportTargetType } from '@/types';

const OUTCOME_TONE: Record<CrivoOutcome, 'success' | 'danger' | 'warning'> = {
  APROVADO: 'success',
  REPROVADO: 'danger',
  ANALISE_MANUAL: 'warning',
};

const RESULT_TONE: Record<string, 'success' | 'danger' | 'warning'> = {
  OK: 'success',
  BLOQUEIO: 'danger',
  ALERTA: 'warning',
};

export function CrivoEvaluatePage() {
  const { data: policies } = usePolicies();
  const evaluate = useEvaluateCrivo();
  const { data: decisions } = useCrivoDecisions();
  const { toast } = useToast();

  const [form, setForm] = useState({ document: '', targetType: 'CNPJ' as ReportTargetType, purpose: '', policyId: '' });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await evaluate.mutateAsync({
        document: form.document,
        targetType: form.targetType,
        purpose: form.purpose,
        policyId: form.policyId || undefined,
      });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao avaliar crédito', description: extractErrorMessage(err) });
    }
  };

  return (
    <div>
      <PageHeader
        title="Crivo — Motor de Decisão de Crédito"
        description="Combina situação cadastral, score e pendências para aprovar, reprovar ou enviar à análise manual"
      />

      <Card>
        <CardHeader>
          <CardTitle>Nova avaliação</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.targetType} onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value as ReportTargetType }))}>
                <option value="CNPJ">CNPJ</option>
                <option value="CPF">CPF</option>
              </Select>
            </div>
            <div>
              <Label>Documento</Label>
              <Input required value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} />
            </div>
            <div>
              <Label>Política</Label>
              <Select value={form.policyId} onChange={(e) => setForm((f) => ({ ...f, policyId: e.target.value }))}>
                <option value="">Padrão da organização</option>
                {policies?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Finalidade (LGPD)</Label>
              <Input required placeholder="Aprovação de crédito p/ contrato" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" loading={evaluate.isPending}>
                <ShieldCheck className="h-4 w-4" /> Avaliar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {evaluate.isError && (
        <Alert tone="danger" title="Falha na avaliação" className="mt-4">
          {extractErrorMessage(evaluate.error)}
        </Alert>
      )}

      {evaluate.data && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <Badge tone={OUTCOME_TONE[evaluate.data.outcome]} className="text-sm">{evaluate.data.outcome.replaceAll('_', ' ')}</Badge>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-400">Score utilizado</p>
                <p className="text-xl font-semibold text-slate-900">{evaluate.data.scoreUsed ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Limite sugerido</p>
                <p className="text-xl font-semibold text-slate-900">{formatCurrency(evaluate.data.suggestedCreditLimit)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Política aplicada</p>
                <p className="text-sm font-medium text-slate-700">{evaluate.data.policy?.name ?? '—'}</p>
              </div>
            </div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Critérios avaliados</p>
            <div className="space-y-2">
              {evaluate.data.reasons.map((r, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{r.criterio}</p>
                    <p className="text-slate-500">{r.detalhe}</p>
                  </div>
                  <Badge tone={RESULT_TONE[r.resultado]}>{r.resultado}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Decisões recentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!decisions ? (
            <Spinner />
          ) : !decisions.length ? (
            <EmptyState title="Nenhuma avaliação realizada ainda" />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Documento</Th>
                  <Th>Resultado</Th>
                  <Th>Score</Th>
                  <Th>Limite sugerido</Th>
                  <Th>Solicitado por</Th>
                  <Th>Quando</Th>
                </Tr>
              </Thead>
              <Tbody>
                {decisions.slice(0, 20).map((d) => (
                  <Tr key={d.id}>
                    <Td>{formatDocument(d.targetDocument)}</Td>
                    <Td><Badge tone={OUTCOME_TONE[d.outcome]}>{d.outcome.replaceAll('_', ' ')}</Badge></Td>
                    <Td>{d.scoreUsed ?? '—'}</Td>
                    <Td>{formatCurrency(d.suggestedCreditLimit)}</Td>
                    <Td>{d.requestedBy?.name}</Td>
                    <Td>{formatDateTime(d.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
