import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Input, Label, Select, Spinner, Badge } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { usePipelines, useDeals, useCreateDeal, useMoveDeal } from '@/hooks/useCrm';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { cn, formatCurrency } from '@/lib/utils';
import type { Deal } from '@/types';

export function PipelinePage() {
  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();
  const pipeline = pipelines?.[0];
  const { data: deals, isLoading: loadingDeals } = useDeals({ pipelineId: pipeline?.id, status: 'ABERTO' });
  const moveDeal = useMoveDeal();
  const createDeal = useCreateDeal();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', value: '', productPlan: '', stageId: '' });
  const [dragDealId, setDragDealId] = useState<string | null>(null);

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const deal of deals ?? []) {
      map[deal.stageId] = map[deal.stageId] ?? [];
      map[deal.stageId].push(deal);
    }
    return map;
  }, [deals]);

  const openDialog = (stageId: string) => {
    setForm({ title: '', value: '', productPlan: '', stageId });
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
      });
      toast({ tone: 'success', title: 'Negociação criada' });
      setDialogOpen(false);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao criar negociação', description: extractErrorMessage(err) });
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
      <PageHeader title="Funil de Vendas" description="Arraste os cards entre as etapas para atualizar o status" />
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
              <button onClick={() => openDialog(stage.id)} className="text-slate-400 hover:text-brand-300">
                <Plus className="h-4 w-4" />
              </button>
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
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Nova negociação">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
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
