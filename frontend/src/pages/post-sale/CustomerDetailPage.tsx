import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Spinner, Textarea } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCustomer, useCreateContract, useCreateInteraction, useRecordChurnSignal } from '@/hooks/usePostSale';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { cn, formatCurrency, formatDate, formatDateTime, formatDocument } from '@/lib/utils';
import type { InteractionType } from '@/types';

const CHURN_SIGNAL_TYPES = ['ATRASO_PAGAMENTO', 'RECLAMACAO', 'CANCELAMENTO_SOLICITADO', 'BAIXO_USO'];

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useCustomer(id);
  const createInteraction = useCreateInteraction();
  const createContract = useCreateContract();
  const recordSignal = useRecordChurnSignal();
  const { toast } = useToast();

  const [tab, setTab] = useState('interacoes');
  const [interaction, setInteraction] = useState({ type: 'LIGACAO' as InteractionType, summary: '', notes: '' });
  const [contract, setContract] = useState({ planName: '', value: '', startDate: '' });
  const [signal, setSignal] = useState({ signalType: CHURN_SIGNAL_TYPES[0], weight: '2', notes: '' });

  const onAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await createInteraction.mutateAsync({ ...interaction, customerId: id });
      setInteraction({ type: 'LIGACAO', summary: '', notes: '' });
      toast({ tone: 'success', title: 'Interação registrada' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao registrar interação', description: extractErrorMessage(err) });
    }
  };

  const onAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await createContract.mutateAsync({ ...contract, value: Number(contract.value), customerId: id });
      setContract({ planName: '', value: '', startDate: '' });
      toast({ tone: 'success', title: 'Contrato adicionado' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao adicionar contrato', description: extractErrorMessage(err) });
    }
  };

  const onAddSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await recordSignal.mutateAsync({ ...signal, weight: Number(signal.weight), customerId: id });
      setSignal({ signalType: CHURN_SIGNAL_TYPES[0], weight: '2', notes: '' });
      toast({ tone: 'success', title: 'Sinal de risco registrado', description: 'Score de churn recalculado.' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao registrar sinal', description: extractErrorMessage(err) });
    }
  };

  if (isLoading || !customer) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const queryHref =
    customer.documentType === 'CNPJ'
      ? `/consultas/cnpj?document=${customer.document}`
      : customer.document
        ? `/consultas/cpf?document=${customer.document}`
        : null;

  return (
    <div>
      <PageHeader
        title={customer.name}
        description={`${customer.documentType ?? 'Documento'}: ${formatDocument(customer.document)}`}
        actions={
          queryHref && (
            <Link
              to={queryHref}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Search className="h-4 w-4" /> Consultar {customer.documentType}
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-400">Status:</span> <Badge tone="success">{customer.status}</Badge></p>
            <p><span className="text-slate-400">Plano:</span> {customer.planName ?? '—'}</p>
            <p><span className="text-slate-400">Mensalidade:</span> {formatCurrency(customer.monthlyValue)}</p>
            <p><span className="text-slate-400">Início do contrato:</span> {formatDate(customer.contractStartDate)}</p>
            <p><span className="text-slate-400">E-mail:</span> {customer.email ?? '—'}</p>
            <p><span className="text-slate-400">Telefone:</span> {customer.phone ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Risco de churn</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-3xl font-semibold text-slate-900">{customer.churnRiskScore ?? '—'}</p>
            <Badge tone={customer.churnRiskLevel === 'ALTO' ? 'danger' : customer.churnRiskLevel === 'MEDIO' ? 'warning' : 'success'}>
              {customer.churnRiskLevel ?? 'SEM DADOS'}
            </Badge>
            <p className="text-xs text-slate-400">Calculado a partir dos sinais registrados nos últimos 90 dias.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Registrar sinal de risco</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onAddSignal} className="space-y-2">
              <Select value={signal.signalType} onChange={(e) => setSignal((s) => ({ ...s, signalType: e.target.value }))}>
                {CHURN_SIGNAL_TYPES.map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
              </Select>
              <Select value={signal.weight} onChange={(e) => setSignal((s) => ({ ...s, weight: e.target.value }))}>
                {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Peso {w}</option>)}
              </Select>
              <Button type="submit" size="sm" className="w-full" loading={recordSignal.isPending}>Registrar</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Tabs value={tab} onChange={setTab}>
          <TabsList>
            <TabsTrigger value="interacoes">Histórico de Atendimento</TabsTrigger>
            <TabsTrigger value="contratos">Contratos</TabsTrigger>
            <TabsTrigger value="transacoes">Financeiro</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === 'interacoes' && (
          <Card className="mt-3">
            <CardContent>
              <form onSubmit={onAddInteraction} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
                <Select value={interaction.type} onChange={(e) => setInteraction((i) => ({ ...i, type: e.target.value as InteractionType }))}>
                  <option value="LIGACAO">Ligação</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="CHAT">Chat</option>
                  <option value="VISITA">Visita</option>
                  <option value="RECLAMACAO">Reclamação</option>
                  <option value="ELOGIO">Elogio</option>
                </Select>
                <Input placeholder="Resumo" required value={interaction.summary} onChange={(e) => setInteraction((i) => ({ ...i, summary: e.target.value }))} />
                <Button type="submit" loading={createInteraction.isPending}>Registrar</Button>
              </form>
              <Textarea
                className="mb-4"
                placeholder="Notas (opcional)"
                value={interaction.notes}
                onChange={(e) => setInteraction((i) => ({ ...i, notes: e.target.value }))}
              />
              <div className="space-y-3">
                {customer.interactions?.length ? (
                  customer.interactions.map((i: any) => (
                    <div key={i.id} className="border-b border-slate-50 pb-2 text-sm last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">
                          <Badge tone={i.type === 'RECLAMACAO' ? 'danger' : 'neutral'}>{i.type}</Badge> {i.summary}
                        </span>
                        <span className="text-xs text-slate-400">{formatDateTime(i.createdAt)}</span>
                      </div>
                      {i.notes && <p className="mt-1 text-slate-500">{i.notes}</p>}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Nenhuma interação registrada.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'contratos' && (
          <Card className="mt-3">
            <CardContent>
              <form onSubmit={onAddContract} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_160px_auto]">
                <Input placeholder="Plano" required value={contract.planName} onChange={(e) => setContract((c) => ({ ...c, planName: e.target.value }))} />
                <Input placeholder="Valor" type="number" step="0.01" required value={contract.value} onChange={(e) => setContract((c) => ({ ...c, value: e.target.value }))} />
                <Input type="date" required value={contract.startDate} onChange={(e) => setContract((c) => ({ ...c, startDate: e.target.value }))} />
                <Button type="submit" loading={createContract.isPending}>Adicionar</Button>
              </form>
              <div className="space-y-2">
                {customer.contracts?.length ? (
                  customer.contracts.map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between border-b border-slate-50 pb-2 text-sm last:border-0">
                      <span>{c.planName}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone="neutral">{c.status}</Badge>
                        <span className="text-slate-500">{formatCurrency(c.value)}</span>
                        <span className="text-xs text-slate-400">desde {formatDate(c.startDate)}</span>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Nenhum contrato cadastrado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'transacoes' && (
          <Card className="mt-3">
            <CardContent className="space-y-2">
              {customer.transactions?.length ? (
                customer.transactions.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between border-b border-slate-50 pb-2 text-sm last:border-0">
                    <span>{t.description}</span>
                    <span className={cn('font-medium', t.type === 'RECEITA' ? 'text-emerald-600' : 'text-red-600')}>
                      {formatCurrency(t.amount)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Nenhuma transação vinculada a este cliente.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
