import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Spinner, Textarea } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { useDeal, useCloseDeal, useCreateActivity, useUpdateLead } from '@/hooks/useCrm';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

export function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: deal, isLoading } = useDeal(id);
  const closeDeal = useCloseDeal();
  const createActivity = useCreateActivity();
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', companyName: '' });

  const onOpenEdit = () => {
    if (!deal?.lead) return;
    setEditForm({
      name: deal.lead.name ?? '',
      email: deal.lead.email ?? '',
      phone: deal.lead.phone ?? '',
      companyName: deal.lead.companyName ?? '',
    });
    setEditOpen(true);
  };

  const onSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deal?.lead) return;
    try {
      await updateLead.mutateAsync({
        id: deal.lead.id,
        name: editForm.name.trim(),
        email: editForm.email.trim() || null,
        // O back-end normaliza pro padrão 55 + DDD + 9 dígitos sozinho.
        phone: editForm.phone.trim() || null,
        companyName: editForm.companyName.trim() || null,
      });
      toast({ tone: 'success', title: 'Lead atualizado' });
      setEditOpen(false);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao atualizar lead', description: extractErrorMessage(err) });
    }
  };

  const onClose = async (outcome: 'GANHO' | 'PERDIDO') => {
    if (!id) return;
    try {
      await closeDeal.mutateAsync({ id, outcome, lostReason: outcome === 'PERDIDO' ? lostReason : undefined });
      toast({
        tone: outcome === 'GANHO' ? 'success' : 'warning',
        title: outcome === 'GANHO' ? 'Negociação marcada como ganha 🎉' : 'Negociação marcada como perdida',
        description: outcome === 'GANHO' ? 'Cliente criado automaticamente no módulo de pós-venda.' : undefined,
      });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao atualizar negociação', description: extractErrorMessage(err) });
    }
  };

  const onAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !note.trim()) return;
    try {
      await createActivity.mutateAsync({ type: 'NOTA', title: 'Nota', notes: note, dealId: id });
      setNote('');
      toast({ tone: 'success', title: 'Nota adicionada' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao adicionar nota', description: extractErrorMessage(err) });
    }
  };

  if (isLoading || !deal) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={deal.title}
        description={`${formatCurrency(deal.value)} · ${deal.productPlan ?? 'Sem plano definido'}`}
        actions={
          deal.status === 'ABERTO' && (
            <>
              <Button variant="outline" onClick={() => onClose('PERDIDO')} loading={closeDeal.isPending}>
                Marcar como perdida
              </Button>
              <Button onClick={() => onClose('GANHO')} loading={closeDeal.isPending}>
                Marcar como ganha
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-slate-400">Status:</span>{' '}
              <Badge tone={deal.status === 'GANHO' ? 'success' : deal.status === 'PERDIDO' ? 'danger' : 'info'}>
                {deal.status}
              </Badge>
            </p>
            <p><span className="text-slate-400">Etapa:</span> {deal.stage.name}</p>
            <p><span className="text-slate-400">Responsável:</span> {deal.owner.name}</p>
            {deal.lead && (
              <p className="flex items-center gap-1.5">
                <span className="text-slate-400">Lead:</span>{' '}
                <Link to={`/crm/leads/${deal.lead.id}`} className="text-brand-300 hover:underline">
                  {deal.lead.name}
                </Link>
                <button type="button" onClick={onOpenEdit} className="text-slate-400 hover:text-brand-300" title="Editar nome, e-mail, telefone e empresa deste lead">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </p>
            )}
            {deal.expectedCloseDate && (
              <p><span className="text-slate-400">Previsão de fechamento:</span> {formatDate(deal.expectedCloseDate)}</p>
            )}
            {deal.lostReason && <p><span className="text-slate-400">Motivo da perda:</span> {deal.lostReason}</p>}
          </CardContent>
        </Card>

        {deal.status === 'ABERTO' && (
          <Card>
            <CardHeader>
              <CardTitle>Se for marcar como perdida</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Motivo da perda (opcional)"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Histórico de atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onAddNote} className="mb-4 flex gap-2">
            <Textarea placeholder="Adicionar nota..." value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
            <Button type="submit" loading={createActivity.isPending}>
              Adicionar
            </Button>
          </form>
          <div className="space-y-3">
            {deal.activities?.length ? (
              deal.activities.map((act: any) => (
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
              <p className="text-sm text-slate-400">Nenhuma atividade registrada.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {deal.lead && (
        <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Editar lead">
          <form onSubmit={onSaveEdit} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input required value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                placeholder="Ex.: 44998771425"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <p className="mt-1 text-xs text-slate-500">
                Pode digitar com ou sem +55, com ou sem o 9º dígito — o sistema normaliza sozinho.
              </p>
            </div>
            <div>
              <Label>Empresa</Label>
              <Input value={editForm.companyName} onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))} />
            </div>
            <Button type="submit" className="w-full" loading={updateLead.isPending}>
              Salvar
            </Button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
