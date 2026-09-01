import { useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardContent, Input, Label, Spinner, EmptyState } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/dialog';
import { usePolicies, useCreatePolicy, useUpdatePolicy } from '@/hooks/useCrivo';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import type { CreditPolicy } from '@/types';

const DEFAULT_FORM = {
  name: '',
  isDefault: false,
  minScoreApproved: 700,
  minScoreManualReview: 400,
  maxPendenciasAllowed: 0,
  blockIfCnpjInativa: true,
  flagIfChurnRiskAlto: true,
  creditLimitPerScorePoint: 10,
  maxCreditLimit: 50000,
};

export function PoliciesPage() {
  const { data: policies, isLoading } = usePolicies();
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CreditPolicy | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: CreditPolicy) => {
    setEditing(p);
    setForm({
      name: p.name,
      isDefault: p.isDefault,
      minScoreApproved: p.minScoreApproved,
      minScoreManualReview: p.minScoreManualReview,
      maxPendenciasAllowed: p.maxPendenciasAllowed,
      blockIfCnpjInativa: p.blockIfCnpjInativa,
      flagIfChurnRiskAlto: p.flagIfChurnRiskAlto,
      creditLimitPerScorePoint: Number(p.creditLimitPerScorePoint),
      maxCreditLimit: Number(p.maxCreditLimit),
    });
    setDialogOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updatePolicy.mutateAsync({ id: editing.id, ...form });
      } else {
        await createPolicy.mutateAsync(form);
      }
      toast({ tone: 'success', title: editing ? 'Política atualizada' : 'Política criada' });
      setDialogOpen(false);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao salvar política', description: extractErrorMessage(err) });
    }
  };

  return (
    <div>
      <PageHeader
        title="Políticas de Crédito"
        description="Regras que o Crivo usa para aprovar, reprovar ou enviar à análise manual"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nova política
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !policies?.length ? (
        <EmptyState title="Nenhuma política configurada" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {policies.map((p) => (
            <Card key={p.id} className="cursor-pointer p-5" onClick={() => openEdit(p)}>
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-slate-900">{p.name}</p>
                <div className="flex items-center gap-1.5">
                  {p.isDefault && <Badge tone="info"><Star className="mr-1 h-3 w-3" />Padrão</Badge>}
                  <Badge tone={p.active ? 'success' : 'neutral'}>{p.active ? 'Ativa' : 'Inativa'}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                <p>Score aprovação: <b>{p.minScoreApproved}</b></p>
                <p>Score análise manual: <b>{p.minScoreManualReview}</b></p>
                <p>Pendências máx.: <b>{p.maxPendenciasAllowed}</b></p>
                <p>Bloqueia CNPJ inativo: <b>{p.blockIfCnpjInativa ? 'Sim' : 'Não'}</b></p>
                <p>R$/ponto de score: <b>{Number(p.creditLimitPerScorePoint)}</b></p>
                <p>Limite máx.: <b>R$ {Number(p.maxCreditLimit).toLocaleString('pt-BR')}</b></p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Editar política' : 'Nova política'}>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Score mínimo p/ aprovação</Label>
              <Input type="number" min={0} max={1000} value={form.minScoreApproved} onChange={(e) => setForm((f) => ({ ...f, minScoreApproved: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Score mínimo p/ análise manual</Label>
              <Input type="number" min={0} max={1000} value={form.minScoreManualReview} onChange={(e) => setForm((f) => ({ ...f, minScoreManualReview: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Máx. pendências permitidas</Label>
              <Input type="number" min={0} value={form.maxPendenciasAllowed} onChange={(e) => setForm((f) => ({ ...f, maxPendenciasAllowed: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>R$ por ponto de score</Label>
              <Input type="number" min={0} step="0.01" value={form.creditLimitPerScorePoint} onChange={(e) => setForm((f) => ({ ...f, creditLimitPerScorePoint: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <Label>Limite de crédito máximo (R$)</Label>
            <Input type="number" min={0} value={form.maxCreditLimit} onChange={(e) => setForm((f) => ({ ...f, maxCreditLimit: Number(e.target.value) }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.blockIfCnpjInativa} onChange={(e) => setForm((f) => ({ ...f, blockIfCnpjInativa: e.target.checked }))} />
            Bloquear automaticamente CNPJ não ativo
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.flagIfChurnRiskAlto} onChange={(e) => setForm((f) => ({ ...f, flagIfChurnRiskAlto: e.target.checked }))} />
            Sinalizar para análise manual se cliente já tiver risco de churn alto
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
            Definir como política padrão da organização
          </label>
          <Button type="submit" className="w-full" loading={createPolicy.isPending || updatePolicy.isPending}>
            Salvar política
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
