import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Spinner, Textarea } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useLead } from '@/hooks/useCrm';
import { useCreateActivity } from '@/hooks/useCrm';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatCurrency, formatDateTime, formatDocument } from '@/lib/utils';
import { usePushLiroCrmTag } from '@/hooks/useIntegrations';
import type { ActivityType } from '@/types';

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: lead, isLoading } = useLead(id);
  const createActivity = useCreateActivity();
  const pushTag = usePushLiroCrmTag();
  const { toast } = useToast();
  const [activity, setActivity] = useState({ type: 'LIGACAO' as ActivityType, title: '', notes: '' });
  const [tagName, setTagName] = useState('');

  const onPushTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !tagName.trim()) return;
    try {
      await pushTag.mutateAsync({ leadId: id, tagName });
      toast({ tone: 'success', title: 'Tag enviada ao Liro CRM' });
      setTagName('');
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao enviar tag', description: extractErrorMessage(err) });
    }
  };

  const onAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await createActivity.mutateAsync({ ...activity, leadId: id });
      setActivity({ type: 'LIGACAO', title: '', notes: '' });
      toast({ tone: 'success', title: 'Atividade registrada' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao registrar atividade', description: extractErrorMessage(err) });
    }
  };

  if (isLoading || !lead) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const queryHref =
    lead.documentType === 'CNPJ'
      ? `/consultas/cnpj?document=${lead.document}`
      : lead.document
        ? `/consultas/cpf?document=${lead.document}`
        : null;

  return (
    <div>
      <PageHeader
        title={lead.name}
        description={`${lead.documentType ?? 'Documento'}: ${formatDocument(lead.document)}`}
        actions={
          queryHref && (
            <Link
              to={queryHref}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200',
              )}
            >
              <Search className="h-4 w-4" /> Consultar {lead.documentType}
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Dados do lead</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-slate-400">Status:</span> <Badge tone="info">{lead.status}</Badge></p>
            <p><span className="text-slate-400">E-mail:</span> {lead.email || '—'}</p>
            <p><span className="text-slate-400">Telefone:</span> {lead.phone || '—'}</p>
            <p><span className="text-slate-400">Empresa:</span> {lead.companyName || '—'}</p>
            <p><span className="text-slate-400">Origem:</span> {lead.source || '—'}</p>
            <p><span className="text-slate-400">Responsável:</span> {lead.assignedTo?.name || '—'}</p>
            <p>
              <span className="text-slate-400">Liro CRM:</span>{' '}
              {lead.liroContactId ? (
                <Badge tone="success">Contato vinculado</Badge>
              ) : (
                <Badge tone="neutral">Não vinculado</Badge>
              )}
            </p>
          </CardContent>
          <CardContent className="border-t border-slate-300/60 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Enviar tag ao Liro CRM</p>
            <form onSubmit={onPushTag} className="flex gap-2">
              <Input
                placeholder="Ex.: Lead quente"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
              />
              <Button type="submit" size="sm" loading={pushTag.isPending}>
                Enviar
              </Button>
            </form>
            <p className="mt-1 text-xs text-slate-500">
              {lead.liroContactId
                ? 'Aplica a tag no contato já vinculado.'
                : 'Sem telefone, o vínculo não pode ser criado.'}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Negociações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lead.deals?.length ? (
              lead.deals.map((deal: any) => (
                <Link
                  key={deal.id}
                  to={`/crm/deals/${deal.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-800">{deal.title}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone="neutral">{deal.stage.name}</Badge>
                    <span className="text-slate-500">{formatCurrency(deal.value)}</span>
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-400">Nenhuma negociação vinculada.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAddActivity} className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr_auto]">
            <Select value={activity.type} onChange={(e) => setActivity((a) => ({ ...a, type: e.target.value as ActivityType }))}>
              <option value="LIGACAO">Ligação</option>
              <option value="REUNIAO">Reunião</option>
              <option value="EMAIL">E-mail</option>
              <option value="PROPOSTA">Proposta</option>
              <option value="TAREFA">Tarefa</option>
              <option value="NOTA">Nota</option>
            </Select>
            <Input
              placeholder="Título da atividade"
              required
              value={activity.title}
              onChange={(e) => setActivity((a) => ({ ...a, title: e.target.value }))}
            />
            <Button type="submit" loading={createActivity.isPending}>
              Registrar
            </Button>
          </form>
          <Textarea
            className="mb-4"
            placeholder="Notas (opcional)"
            value={activity.notes}
            onChange={(e) => setActivity((a) => ({ ...a, notes: e.target.value }))}
          />
          <div className="space-y-3">
            {lead.activities?.length ? (
              lead.activities.map((act: any) => (
                <div key={act.id} className="border-b border-slate-50 pb-2 text-sm last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      <Badge tone="neutral">{act.type}</Badge> {act.title}
                    </span>
                    <span className="text-xs text-slate-400">{formatDateTime(act.createdAt)}</span>
                  </div>
                  {act.notes && <p className="mt-1 text-slate-500">{act.notes}</p>}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Nenhuma atividade registrada ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
