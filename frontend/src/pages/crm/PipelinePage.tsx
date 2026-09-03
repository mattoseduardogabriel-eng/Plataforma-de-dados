import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Input, Label, Select, Spinner, Badge } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import {
  usePipelines,
  useDeals,
  useCreateDeal,
  useMoveDeal,
  useMoveDeals,
  useRemoveDeals,
  useCreatePipelineStage,
  useDeletePipelineStage,
} from '@/hooks/useCrm';
import { useLiroCrmStatus, useSyncLiroCrmContacts } from '@/hooks/useIntegrations';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage, useAuth } from '@/lib/auth-context';
import { cn, formatCurrency } from '@/lib/utils';
import type { Deal } from '@/types';

interface Retangulo {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

// Dois retângulos se cruzam se não existir um eixo em que um esteja
// inteiramente antes do outro.
function retangulosSeCruzam(a: Retangulo, b: Retangulo) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

// Miniatura customizada pro drag quando é um grupo (mais de 1 selecionado)
// — sem isso o navegador usa como "fantasma" só o card em que o mouse
// tocou, o que engana arrastando vários de uma vez. Cria um elemento fora
// da tela, usa como imagem de drag, e remove logo em seguida (o navegador
// já copiou a imagem de forma síncrona no dragstart).
function usarImagemDeArrastoEmGrupo(e: React.DragEvent, quantidade: number) {
  const el = document.createElement('div');
  el.textContent = `${quantidade} selecionados`;
  el.className = 'rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white';
  el.style.cssText = 'position:fixed;top:-1000px;left:-1000px;';
  document.body.appendChild(el);
  e.dataTransfer.setDragImage(el, 16, 16);
  setTimeout(() => document.body.removeChild(el), 0);
}

export function PipelinePage() {
  const { data: pipelines, isLoading: loadingPipelines } = usePipelines();
  const pipeline = pipelines?.[0];
  const { data: deals, isLoading: loadingDeals, isFetching: fetchingDeals, refetch: refetchDeals } = useDeals({ pipelineId: pipeline?.id, status: 'ABERTO' });
  const moveDeal = useMoveDeal();
  const moveDeals = useMoveDeals();
  const removeDeals = useRemoveDeals();
  const createDeal = useCreateDeal();
  const createStage = useCreatePipelineStage();
  const deleteStage = useDeletePipelineStage();
  const { data: liroStatus } = useLiroCrmStatus();
  const syncLiro = useSyncLiroCrmContacts();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const isManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'GESTOR';

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', value: '', productPlan: '', stageId: '', contactName: '', contactPhone: '', contactDocument: '' });
  const [dragDealId, setDragDealId] = useState<string | null>(null);
  const [dragGrupo, setDragGrupo] = useState(false); // true = arrastando toda a seleção junto, não só um card
  const [novaEtapaAberta, setNovaEtapaAberta] = useState(false);
  const [novaEtapaNome, setNovaEtapaNome] = useState('');

  // Seleção múltipla por retângulo — clicar num espaço vazio do quadro e
  // arrastar o mouse, tipo selecionar ícones na área de trabalho — pra
  // mover ou remover vários negócios do funil de uma vez. Só começa o
  // retângulo quando o clique inicial NÃO é em cima de um card/botão/input,
  // então não interfere no drag individual de um card (que continua igual).
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [etapaDestinoBulk, setEtapaDestinoBulk] = useState('');

  function iniciarSelecaoPorRetangulo(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-kanban-card], button, input, form, select')) return;
    setSelecionados(new Set());
    const inicio = { startX: e.clientX, startY: e.clientY, curX: e.clientX, curY: e.clientY };
    setMarquee(inicio);

    function aoMover(ev: MouseEvent) {
      const atual = { ...inicio, curX: ev.clientX, curY: ev.clientY };
      setMarquee(atual);
      const retSelecao: Retangulo = {
        left: Math.min(atual.startX, atual.curX),
        right: Math.max(atual.startX, atual.curX),
        top: Math.min(atual.startY, atual.curY),
        bottom: Math.max(atual.startY, atual.curY),
      };
      const novos = new Set<string>();
      for (const [id, el] of cardRefs.current) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (retangulosSeCruzam(retSelecao, { left: r.left, right: r.right, top: r.top, bottom: r.bottom })) {
          novos.add(id);
        }
      }
      setSelecionados(novos);
    }
    function aoSoltar() {
      window.removeEventListener('mousemove', aoMover);
      window.removeEventListener('mouseup', aoSoltar);
      setMarquee(null);
    }
    window.addEventListener('mousemove', aoMover);
    window.addEventListener('mouseup', aoSoltar);
  }

  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const deal of deals ?? []) {
      map[deal.stageId] = map[deal.stageId] ?? [];
      map[deal.stageId].push(deal);
    }
    return map;
  }, [deals]);

  // Se a lista atualiza (poll automático, ou alguém moveu/fechou por fora)
  // e um negócio selecionado sumiu, tira ele da seleção.
  useEffect(() => {
    setSelecionados((prev) => {
      const validos = new Set([...prev].filter((id) => deals?.some((d) => d.id === id)));
      return validos.size === prev.size ? prev : validos;
    });
  }, [deals]);

  const moverSelecionadosPara = async (stageId: string) => {
    if (!stageId || selecionados.size === 0) return;
    const ids = [...selecionados];
    try {
      const { falhas } = await moveDeals.mutateAsync({ ids, stageId });
      if (falhas > 0) toast({ tone: 'error', title: `${falhas} de ${ids.length} não puderam ser movidos` });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao mover negociações', description: extractErrorMessage(err) });
    } finally {
      setSelecionados(new Set());
      setEtapaDestinoBulk('');
    }
  };

  const removerSelecionadosDoFunil = async () => {
    if (selecionados.size === 0) return;
    if (!confirm(`Remover ${selecionados.size} negociação(ões) selecionada(s) do Funil de Vendas? O lead continua existindo, só sai do funil.`)) return;
    const ids = [...selecionados];
    try {
      await removeDeals.mutateAsync(ids);
      toast({ tone: 'success', title: `${ids.length} negociação(ões) removida(s) do funil` });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao remover negociações', description: extractErrorMessage(err) });
    } finally {
      setSelecionados(new Set());
    }
  };

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

  // "Atualizar" não é só recarregar a tela: se o Liro CRM estiver
  // conectado, primeiro roda a sincronização de contatos de verdade (a
  // mesma de Configurações > Integrações), pra trazer lead/negócio novo
  // na hora — sem isso a pessoa tinha que ir até lá pra forçar o mesmo
  // resultado que devia sair daqui. A sincronização automática (a cada 5
  // min, ver LiroCrmSyncScheduler no backend) continua rodando sozinha;
  // isso aqui só cobre "eu não quero esperar".
  const onAtualizar = async () => {
    if (liroStatus?.configured) {
      try {
        await syncLiro.mutateAsync();
      } catch (err) {
        toast({ tone: 'error', title: 'Erro ao sincronizar com o Liro CRM', description: extractErrorMessage(err) });
      }
    }
    await refetchDeals();
  };

  const onDrop = async (stageId: string) => {
    if (dragGrupo) {
      await moverSelecionadosPara(stageId);
      setDragDealId(null);
      setDragGrupo(false);
      return;
    }
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
        description="Arraste um card pra mudar de etapa, ou clique num espaço vazio e arraste o mouse pra selecionar vários"
        actions={
          <Button size="sm" variant="outline" onClick={onAtualizar} loading={fetchingDeals || syncLiro.isPending}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        }
      />

      {selecionados.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm">
          <strong className="font-medium text-slate-700">
            {selecionados.size} selecionado{selecionados.size > 1 ? 's' : ''}
          </strong>
          <Select value={etapaDestinoBulk} onChange={(e) => setEtapaDestinoBulk(e.target.value)} className="h-8 w-auto text-sm">
            <option value="">Mover para...</option>
            {pipeline?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={() => moverSelecionadosPara(etapaDestinoBulk)} disabled={!etapaDestinoBulk} loading={moveDeals.isPending}>
            Mover
          </Button>
          <Button size="sm" variant="destructive" onClick={removerSelecionadosDoFunil} loading={removeDeals.isPending}>
            <Trash2 className="h-4 w-4" /> Remover do funil
          </Button>
          <button type="button" className="ml-auto text-slate-500 underline hover:text-slate-700" onClick={() => setSelecionados(new Set())}>
            Limpar seleção
          </button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4" onMouseDown={iniciarSelecaoPorRetangulo}>
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
              {(dealsByStage[stage.id] ?? []).map((deal) => {
                const selecionado = selecionados.has(deal.id);
                return (
                  <div
                    key={deal.id}
                    data-kanban-card="true"
                    ref={(el) => {
                      if (el) cardRefs.current.set(deal.id, el);
                      else cardRefs.current.delete(deal.id);
                    }}
                    draggable
                    onDragStart={(e) => {
                      // Arrastar um card que já faz parte da seleção (2+) leva o
                      // grupo inteiro junto; arrastar um card fora da seleção
                      // arrasta só ele (e limpa a seleção antiga, pra não sobrar
                      // destaque de algo que não foi movido).
                      if (selecionado && selecionados.size > 1) {
                        setDragGrupo(true);
                        usarImagemDeArrastoEmGrupo(e, selecionados.size);
                      } else {
                        setSelecionados(new Set());
                      }
                      setDragDealId(deal.id);
                    }}
                    onDragEnd={() => {
                      setDragDealId(null);
                      setDragGrupo(false);
                    }}
                    onClick={() => navigate(`/crm/deals/${deal.id}`)}
                    title="Clique pra abrir · arraste pra mudar de etapa · clique num espaço vazio e arraste pra selecionar vários (e depois arraste o grupo junto)"
                    className={cn(
                      'cursor-grab rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-card active:cursor-grabbing',
                      (dragDealId === deal.id || (dragGrupo && selecionado)) && 'opacity-50',
                      selecionado && 'border-brand-400 ring-2 ring-brand-300',
                    )}
                  >
                    <p className="text-sm font-medium text-slate-900">{deal.title}</p>
                    {deal.productPlan && <p className="mt-0.5 text-xs text-slate-500">{deal.productPlan}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-brand-300">{formatCurrency(deal.value)}</span>
                      <span className="text-xs text-slate-400">{deal.owner.name.split(' ')[0]}</span>
                    </div>
                  </div>
                );
              })}
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

      {marquee && (
        <div
          className="pointer-events-none fixed z-50 rounded border border-brand-400 bg-brand-300/15"
          style={{
            left: Math.min(marquee.startX, marquee.curX),
            top: Math.min(marquee.startY, marquee.curY),
            width: Math.abs(marquee.curX - marquee.startX),
            height: Math.abs(marquee.curY - marquee.startY),
          }}
        />
      )}
    </div>
  );
}
