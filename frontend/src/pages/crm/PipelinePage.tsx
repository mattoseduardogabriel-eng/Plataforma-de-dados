import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Input, Label, Select, Spinner, Badge } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { usePipelines, useDeals, useCreateDeal, useMoveDeal, useCreatePipelineStage, useDeletePipelineStage } from '@/hooks/useCrm';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage, useAuth } from '@/lib/auth-context';
import { cn, formatCurrency } from '@/lib/utils';
import type { Deal } from '@/types';

export function PipelinePage() {
  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();
  const pipeline = pipelines?.[0];
  const { data: deals, isLoading: loadingDeals, isFetching: fetchingDeals, refetch: refetchDeals } = useDeals({ pipelineId: pipeline?.id, status: 'ABERTO' });
  const moveDeal = useMoveDeal();
  const createDeal = useCreateDeal();
  const createStage = useCreatePipelineStage();
  const deleteStage = useDeletePipelineStage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'GESTOR';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', value: '', productPlan: '', stageId: '', contactName: '', contactPhone: '', contactDocument: '' });
  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const [novaEtapaAberta, setNovaEtapaAberta] = useState(false);
  const [novaEtapaNome, setNovaEtapaNome] = useState('');

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const deal of deals ?? []) {
      map[deal.stageId] = map[deal.stageId] ?? [];
      map[deal.stageId].push(deal);
    }
    return map;
  }, [deals]);

  const openDialog = (stageId: string) => {
    setForm({ title: '', value: '', productPlan: '', stageId, contactName: '', contactPhone: '', contactDocument: '' });
    setDialogOpen(true);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipeline) return;
    try {
      await createDeal.mutateAsync({
        title: form.title,
        value: Number(form.value || 0),
        productPlan: form.productPlan || undefined,
        pipelineId: pipeline.id,
        stageId: form.stageId,
        contactName: form.contactName || undefined,
        contactPhone: form.contactPhone || undefined,
        contactDocument: form.contactDocument || undefined,
      });
      toast({ tone: 'success', title: 'Negociação criada' });
      setDialogOpen(false);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao criar negociação', description: extractErrorMessage(err) });
    }
  };

  const onCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipeline || !novaEtapaNome.trim()) return;
    try {
      await createStage.mutateAsync({ pipelineId: pipeline.id, name: novaEtapaNome.trim() });
      setNovaEtapaNome('');
      setNovaEtapaAberta(false);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao criar etapa', description: extractErrorMessage(err) });
    }
  };

  const onDeleteStage = async (stageId: string, stageName: string) => {
    if (!confirm(`Excluir a etapa "${stageName}"? Só dá se não tiver nenhuma negociação nela.`)) return;
    try {
      await deleteStage.mutateAsync(stageId);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao excluir etapa', description: extractErrorMessage(err) });
    }
  };

  const onDrop = async (stageId: string) => {
    if (!dragDealId) return;
    try {
      await moveDeal.mutateAsync({ id: dragDealId, stageId });
    } catch (err) {
      toast({ tone: 'error', title: 'Não foi possível mover a negociação', description: extractErrorMessage(err) });
    } finally {
      setDragDealId(null);
    }
  };

  if (loadingPipelines || loadingDeals) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Funil de Vendas"
        description="Arraste os cards entre as etapas para atualizar o status"
        actions={
          <Button size="sm" variant="outline" onClick={() => refetchDeals()} loading={fetchingDeals}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        }
      />
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipeline?.stages.map((stage) => (
          <div
            key={stage.id}
            className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-200/40 p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(stage.id)}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.colorHex }} />
                <span className="text-sm font-semibold text-slate-700">{stage.name}</span>
                <Badge tone="neutral">{dealsByStage[stage.id]?.length ?? 0}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openDialog(stage.id)} className="text-slate-400 hover:text-brand-300" title="Nova negociação nesta etapa">
                  <Plus className="h-4 w-4" />
                </button>
                {isManager && (
                  <button
                    onClick={() => onDeleteStage(stage.id, stage.name)}
                    className="text-slate-400 hover:text-red-400"
                    title="Excluir etapa (só se estiver vazia)"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {(dealsByStage[stage.id] ?? []).map((deal) => (
                <Card
                  key={deal.id}
                  draggable
                  onDragStart={() => setDragDealId(deal.id)}
                  onClick={() => navigate(`/crm/deals/${deal.id}`)}
                  className={cn(
                    'cursor-grab p-3 active:cursor-grabbing',
                    dragDealId === deal.id && 'opacity-50',
                  )}
                >
                  <p className="text-sm font-medium text-slate-900">{deal.title}</p>
                  {deal.productPlan && <p className="mt-0.5 text-xs text-slate-500">{deal.productPlan}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-brand-300">{formatCurrency(deal.value)}</span>
                    <span className="text-xs text-slate-400">{deal.owner.name.split(' ')[0]}</span>
                  </div>
                </Card>
              ))}
              {!(dealsByStage[stage.id] ?? []).length && (
                <p className="px-1 py-4 text-center text-xs text-slate-400">Nenhuma negociação</p>
              )}
            </div>
          </div>
        ))}

        {isManager && (
          <div className="w-64 shrink-0">
            {novaEtapaAberta ? (
              <form onSubmit={onCreateStage} className="rounded-xl border border-dashed border-brand-400 bg-slate-100 p-3">
                <Input
                  autoFocus
                  placeholder="Nome da etapa..."
                  value={novaEtapaNome}
                  onChange={(e) => setNovaEtapaNome(e.target.value)}
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="flex-1" loading={createStage.isPending} disabled={!novaEtapaNome.trim()}>
                    Criar
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { setNovaEtapaAberta(false); setNovaEtapaNome(''); }}>
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setNovaEtapaAberta(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-300"
              >
                <Plus className="h-4 w-4" /> Nova etapa
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Nova negociação">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome do contato</Label>
              <Input
                placeholder="Fulano da Silva"
                value={form.contactName}
                onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                placeholder="5511999998888"
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>CPF ou CNPJ</Label>
            <Input value={form.contactDocument} onChange={(e) => setForm((f) => ({ ...f, contactDocument: e.target.value }))} />
          </div>
          <div>
            <Label>Plano/Produto</Label>
            <Input
              placeholder="Internet Empresarial 500Mb"
              value={form.productPlan}
              onChange={(e) => setForm((f) => ({ ...f, productPlan: e.target.value }))}
            />
          </div>
          <div>
            <Label>Valor mensal (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.value}
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
          </div>
          <div>
            <Label>Etapa</Label>
            <Select value={form.stageId} onChange={(e) => setForm((f) => ({ ...f, stageId: e.target.value }))}>
              {pipeline?.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full" loading={createDeal.isPending}>
            Criar negociação
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
