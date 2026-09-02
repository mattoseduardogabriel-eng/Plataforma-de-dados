import { useState } from 'react';
import { Plus, Users2, KanbanSquare, UserCog, ShieldOff, ShieldCheck, Check, X, CreditCard, Clock } from 'lucide-react';
import {
  useBackofficeOrganizations,
  useCreateBackofficeOrganization,
  useSetOrganizationStatus,
  useDecideOrganizationApproval,
  useUpdateOrganizationSubscription,
} from '@/hooks/useBackoffice';
import type { BackofficeOrganization, SubscriptionStatus } from '@/types';
import { Button, Card, Input, Label, Alert, Badge, Spinner, EmptyState, Select } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api';

function CreateOrganizationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createOrg = useCreateBackofficeOrganization();
  const [form, setForm] = useState({
    organizationName: '',
    organizationCnpj: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createOrg.mutateAsync({
        organizationName: form.organizationName,
        organizationCnpj: form.organizationCnpj || undefined,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      setForm({ organizationName: '', organizationCnpj: '', adminName: '', adminEmail: '', adminPassword: '' });
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível criar a empresa.'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nova empresa cliente">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <Label htmlFor="organizationName">Nome da empresa</Label>
          <Input id="organizationName" required value={form.organizationName} onChange={set('organizationName')} placeholder="Franquia Telecom Sul" />
        </div>
        <div>
          <Label htmlFor="organizationCnpj">CNPJ (opcional)</Label>
          <Input id="organizationCnpj" value={form.organizationCnpj} onChange={set('organizationCnpj')} placeholder="00.000.000/0001-00" />
        </div>
        <div className="border-t border-slate-300/60 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Primeiro usuário (ADMIN)</p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adminName">Nome</Label>
              <Input id="adminName" required value={form.adminName} onChange={set('adminName')} placeholder="Nome do responsável" />
            </div>
            <div>
              <Label htmlFor="adminEmail">E-mail</Label>
              <Input id="adminEmail" type="email" required value={form.adminEmail} onChange={set('adminEmail')} placeholder="responsavel@empresa.com.br" />
            </div>
            <div>
              <Label htmlFor="adminPassword">Senha provisória</Label>
              <Input id="adminPassword" type="text" required minLength={8} value={form.adminPassword} onChange={set('adminPassword')} placeholder="mínimo 8 caracteres" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={createOrg.isPending}>Criar empresa</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ApprovalRow({ org }: { org: BackofficeOrganization }) {
  const decide = useDecideOrganizationApproval();
  const [trialDays, setTrialDays] = useState(14);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const approve = async () => {
    setError(null);
    try {
      await decide.mutateAsync({ id: org.id, decision: 'APPROVE', trialDays });
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível aprovar.'));
    }
  };

  const reject = async () => {
    setError(null);
    try {
      await decide.mutateAsync({ id: org.id, decision: 'REJECT', rejectionReason: reason || undefined });
      setRejecting(false);
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível rejeitar.'));
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-amber-300/40 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-slate-900">{org.name}</p>
        {org.cnpj && <p className="text-xs text-slate-500">{org.cnpj}</p>}
        <p className="text-xs text-slate-500">Cadastrada em {new Date(org.createdAt).toLocaleDateString('pt-BR')}</p>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {rejecting ? (
        <div className="flex flex-1 flex-col gap-2 sm:max-w-sm sm:flex-row sm:items-center">
          <Input
            placeholder="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" loading={decide.isPending} onClick={reject}>Confirmar rejeição</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" /> Trial de
            <Input
              type="number"
              min={0}
              max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
              className="h-7 w-16 px-2 text-center text-xs"
            />
            dias
          </div>
          <Button size="sm" loading={decide.isPending} onClick={approve}>
            <Check className="h-3.5 w-3.5" /> Aprovar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
            <X className="h-3.5 w-3.5" /> Rejeitar
          </Button>
        </div>
      )}
    </div>
  );
}

function subscriptionBadge(org: BackofficeOrganization) {
  const map: Record<SubscriptionStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }> = {
    TRIAL: { label: 'Teste', tone: 'info' },
    ACTIVE: { label: 'Ativa', tone: 'success' },
    PAST_DUE: { label: 'Pagamento pendente', tone: 'warning' },
    CANCELED: { label: 'Cancelada', tone: 'danger' },
  };
  const { label, tone } = map[org.subscriptionStatus];
  return <Badge tone={tone}>{label}</Badge>;
}

function EditSubscriptionDialog({ org, onClose }: { org: BackofficeOrganization | null; onClose: () => void }) {
  const update = useUpdateOrganizationSubscription();
  const [form, setForm] = useState({
    subscriptionStatus: (org?.subscriptionStatus ?? 'TRIAL') as SubscriptionStatus,
    subscriptionPlan: org?.subscriptionPlan ?? '',
    subscriptionPriceReais: org?.subscriptionPriceCents ? String(org.subscriptionPriceCents / 100) : '',
    nextBillingAt: org?.nextBillingAt ? org.nextBillingAt.slice(0, 10) : '',
    trialEndsAt: org?.trialEndsAt ? org.trialEndsAt.slice(0, 10) : '',
  });
  const [error, setError] = useState<string | null>(null);

  if (!org) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await update.mutateAsync({
        id: org.id,
        subscriptionStatus: form.subscriptionStatus,
        subscriptionPlan: form.subscriptionPlan || undefined,
        subscriptionPriceCents: form.subscriptionPriceReais
          ? Math.round(Number(form.subscriptionPriceReais) * 100)
          : undefined,
        nextBillingAt: form.nextBillingAt ? new Date(form.nextBillingAt).toISOString() : undefined,
        trialEndsAt: form.trialEndsAt ? new Date(form.trialEndsAt).toISOString() : undefined,
      });
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível atualizar a assinatura.'));
    }
  };

  return (
    <Dialog open={!!org} onClose={onClose} title={`Assinatura — ${org.name}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <Label htmlFor="subscriptionStatus">Status</Label>
          <Select
            id="subscriptionStatus"
            value={form.subscriptionStatus}
            onChange={(e) => setForm((f) => ({ ...f, subscriptionStatus: e.target.value as SubscriptionStatus }))}
          >
            <option value="TRIAL">Período de teste</option>
            <option value="ACTIVE">Ativa (em dia)</option>
            <option value="PAST_DUE">Pagamento pendente</option>
            <option value="CANCELED">Cancelada</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="subscriptionPlan">Plano</Label>
          <Input
            id="subscriptionPlan"
            value={form.subscriptionPlan}
            onChange={(e) => setForm((f) => ({ ...f, subscriptionPlan: e.target.value }))}
            placeholder="Ex.: Mensal Franquia"
          />
        </div>
        <div>
          <Label htmlFor="subscriptionPriceReais">Valor mensal (R$)</Label>
          <Input
            id="subscriptionPriceReais"
            type="number"
            min={0}
            step="0.01"
            value={form.subscriptionPriceReais}
            onChange={(e) => setForm((f) => ({ ...f, subscriptionPriceReais: e.target.value }))}
            placeholder="299.00"
          />
        </div>
        <div>
          <Label htmlFor="nextBillingAt">Próxima cobrança</Label>
          <Input
            id="nextBillingAt"
            type="date"
            value={form.nextBillingAt}
            onChange={(e) => setForm((f) => ({ ...f, nextBillingAt: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="trialEndsAt">Fim do período de teste</Label>
          <Input
            id="trialEndsAt"
            type="date"
            value={form.trialEndsAt}
            onChange={(e) => setForm((f) => ({ ...f, trialEndsAt: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={update.isPending}>Salvar</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function OrganizationsPage() {
  const { data: organizations, isLoading } = useBackofficeOrganizations();
  const setStatus = useSetOrganizationStatus();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<BackofficeOrganization | null>(null);

  const pending = organizations?.filter((o) => o.approvalStatus === 'PENDING') ?? [];
  const decided = organizations?.filter((o) => o.approvalStatus !== 'PENDING') ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Empresas clientes</h1>
          <p className="text-sm text-slate-500">Gerencie as franquias/empresas que usam a plataforma Aster.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nova empresa
        </Button>
      </div>

      {pending.length > 0 && (
        <Card className="overflow-hidden border-amber-400/40 bg-amber-50 p-0 dark:bg-amber-400/5">
          <div className="border-b border-amber-300/40 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {pending.length} cadastro{pending.length > 1 ? 's' : ''} aguardando aprovação
            </p>
          </div>
          {pending.map((org) => (
            <ApprovalRow key={org.id} org={org} />
          ))}
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Empresa</Th>
                <Th>Usuários</Th>
                <Th>Leads</Th>
                <Th>Clientes</Th>
                <Th>Negócios</Th>
                <Th>Conta</Th>
                <Th>Assinatura</Th>
                <Th>Criada em</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <Tr>
                  <Td colSpan={9} className="py-10 text-center"><Spinner className="mx-auto h-6 w-6" /></Td>
                </Tr>
              ) : decided.length === 0 ? (
                <Tr>
                  <Td colSpan={9}>
                    <EmptyState title="Nenhuma empresa aprovada ainda" description="Crie uma empresa ou aprove um cadastro pendente." />
                  </Td>
                </Tr>
              ) : (
                decided.map((org) => (
                  <Tr key={org.id}>
                    <Td>
                      <p className="font-medium text-slate-900">{org.name}</p>
                      {org.cnpj && <p className="text-xs text-slate-500">{org.cnpj}</p>}
                      {org.approvalStatus === 'REJECTED' && (
                        <Badge tone="danger" className="mt-1">Cadastro rejeitado</Badge>
                      )}
                    </Td>
                    <Td><span className="inline-flex items-center gap-1.5"><Users2 className="h-3.5 w-3.5 text-slate-400" />{org.counts.users}</span></Td>
                    <Td><span className="inline-flex items-center gap-1.5"><KanbanSquare className="h-3.5 w-3.5 text-slate-400" />{org.counts.leads}</span></Td>
                    <Td><span className="inline-flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5 text-slate-400" />{org.counts.customers}</span></Td>
                    <Td>{org.counts.deals}</Td>
                    <Td>
                      {org.active ? (
                        <Badge tone="success">Ativa</Badge>
                      ) : (
                        <Badge tone="danger">Suspensa</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        {subscriptionBadge(org)}
                        {org.subscriptionStatus === 'TRIAL' && org.trialEndsAt && (
                          <span className="text-[11px] text-slate-500">
                            até {new Date(org.trialEndsAt).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        {org.subscriptionPriceCents != null && (
                          <span className="text-[11px] text-slate-500">
                            R$ {(org.subscriptionPriceCents / 100).toFixed(2)}/mês
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td className="text-slate-500">{new Date(org.createdAt).toLocaleDateString('pt-BR')}</Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditingSubscription(org)}>
                          <CreditCard className="h-3.5 w-3.5" /> Assinatura
                        </Button>
                        <Button
                          size="sm"
                          variant={org.active ? 'outline' : 'primary'}
                          loading={setStatus.isPending}
                          onClick={() => setStatus.mutate({ id: org.id, active: !org.active })}
                        >
                          {org.active ? (
                            <><ShieldOff className="h-3.5 w-3.5" /> Suspender</>
                          ) : (
                            <><ShieldCheck className="h-3.5 w-3.5" /> Reativar</>
                          )}
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </Card>

      <CreateOrganizationDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditSubscriptionDialog org={editingSubscription} onClose={() => setEditingSubscription(null)} />
    </div>
  );
}
