import { useEffect, useState } from 'react';
import { Plus, Settings2, ShieldAlert, Trash2, Upload, Users2, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Input, Label, Spinner, Badge, EmptyState, StatCard } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Td, Th } from '@/components/ui/table';
import { ColumnFilterHeader } from '@/components/ui/column-filter-header';
import { Dialog } from '@/components/ui/dialog';
import {
  useCustomers,
  useCreateCustomer,
  usePortfolioOverview,
  useCustomerFieldDefinitions,
  useDeleteCustomers,
  useDeleteAllCustomers,
} from '@/hooks/usePostSale';
import { useToast } from '@/components/ui/toast';
import { useAuth, extractErrorMessage } from '@/lib/auth-context';
import { formatCurrency, formatDocument } from '@/lib/utils';
import type { ChurnRiskLevel, CustomerStatus } from '@/types';
import { CustomerQuickViewModal } from './CustomerQuickViewModal';
import { ImportCustomersDialog } from './ImportCustomersDialog';
import { ManageCustomerFieldsDialog } from './ManageCustomerFieldsDialog';

const RISK_TONE: Record<ChurnRiskLevel, 'success' | 'warning' | 'danger'> = {
  BAIXO: 'success',
  MEDIO: 'warning',
  ALTO: 'danger',
};

const STATUS_TONE: Record<CustomerStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ATIVO: 'success',
  INATIVO: 'neutral',
  SUSPENSO: 'warning',
  CANCELADO: 'danger',
};

const STATUS_OPTIONS = [
  { label: 'Ativo', value: 'ATIVO' },
  { label: 'Inativo', value: 'INATIVO' },
  { label: 'Suspenso', value: 'SUSPENSO' },
  { label: 'Cancelado', value: 'CANCELADO' },
];

const RISK_OPTIONS = [
  { label: 'Baixo', value: 'BAIXO' },
  { label: 'Médio', value: 'MEDIO' },
  { label: 'Alto', value: 'ALTO' },
];

interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export function CustomersPage() {
  const { user } = useAuth();
  const canManageFields = user?.role === 'ADMIN' || user?.role === 'GESTOR';
  // Mesmos papéis liberados pra excluir no back-end (ver customers.controller.ts) — evita mostrar um botão que só vai dar 403.
  const canDelete = user?.role === 'ADMIN' || user?.role === 'GESTOR';

  const { data: fieldDefinitions } = useCustomerFieldDefinitions();

  const [textFilters, setTextFilters] = useState({ name: '', document: '', city: '', planName: '' });
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [riskFilter, setRiskFilter] = useState<string[]>([]);
  const [customFieldFilters, setCustomFieldFilters] = useState<Record<string, string | boolean>>({});
  const [sort, setSort] = useState<SortState | null>(null);

  const { data: customers, isLoading } = useCustomers({
    ...textFilters,
    status: statusFilter,
    churnRiskLevel: riskFilter,
    customFields: customFieldFilters,
    sortBy: sort?.key,
    sortDir: sort?.dir,
  });
  const { data: portfolio } = usePortfolioOverview();
  const createCustomer = useCreateCustomer();
  const deleteCustomers = useDeleteCustomers();
  const deleteAllCustomers = useDeleteAllCustomers();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', city: '', planName: '', monthlyValue: '' });

  // Seleção de linhas — sempre em cima do resultado já filtrado (`customers`),
  // então "selecionar tudo" já pega todos os filtrados no momento, não só o
  // que está visível na tela. Some ao trocar filtro/ordenação pra nunca
  // carregar uma seleção que não corresponde mais ao que está na tela.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds(new Set());
  }, [textFilters, statusFilter, riskFilter, customFieldFilters, sort]);

  const [confirmDeleteSelectedOpen, setConfirmDeleteSelectedOpen] = useState(false);
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');

  const allFilteredIds = customers?.map((c) => c.id) ?? [];
  const allSelected = allFilteredIds.length > 0 && selectedIds.size === allFilteredIds.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allFilteredIds));
  };
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDeleteSelected = async () => {
    try {
      const { deleted } = await deleteCustomers.mutateAsync(Array.from(selectedIds));
      toast({ tone: 'success', title: `${deleted} cliente(s) excluído(s)` });
      setSelectedIds(new Set());
      setConfirmDeleteSelectedOpen(false);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao excluir clientes', description: extractErrorMessage(err) });
    }
  };

  const onDeleteAll = async () => {
    try {
      const { deleted } = await deleteAllCustomers.mutateAsync();
      toast({ tone: 'success', title: `Carteira apagada`, description: `${deleted} cliente(s) excluído(s).` });
      setSelectedIds(new Set());
      setConfirmDeleteAllOpen(false);
      setDeleteAllConfirmText('');
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao excluir a carteira', description: extractErrorMessage(err) });
    }
  };

  const activeCount = portfolio?.byStatus.find((s) => s.status === 'ATIVO')?.count ?? 0;
  const riskAlto = portfolio?.byRisk.find((r) => r.level === 'ALTO')?.count ?? 0;

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customer = await createCustomer.mutateAsync({
        ...form,
        monthlyValue: form.monthlyValue ? Number(form.monthlyValue) : undefined,
        documentType: form.document.replace(/\D/g, '').length === 14 ? 'CNPJ' : form.document ? 'CPF' : undefined,
      });
      toast({ tone: 'success', title: 'Cliente cadastrado' });
      setDialogOpen(false);
      setQuickViewId(customer.id);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao cadastrar cliente', description: extractErrorMessage(err) });
    }
  };

  const sortProps = (key: string) => ({
    sortDir: sort?.key === key ? sort.dir : null,
    onSort: (dir: 'asc' | 'desc' | null) => setSort(dir ? { key, dir } : null),
  });

  return (
    <div>
      <PageHeader
        title="Carteira de Clientes"
        description="Relacionamento e retenção — clientes ativos após conversão no funil de vendas"
        actions={
          <div className="flex gap-2">
            {canManageFields && (
              <Button variant="outline" onClick={() => setFieldsOpen(true)}>
                <Settings2 className="h-4 w-4" /> Campos personalizados
              </Button>
            )}
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Importar planilha
            </Button>
            {canDelete && (
              <Button variant="destructive" onClick={() => setConfirmDeleteAllOpen(true)}>
                <Trash2 className="h-4 w-4" /> Excluir base toda
              </Button>
            )}
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Novo cliente
            </Button>
          </div>
        }
      />

      {canDelete && selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-sm">
          <span className="font-medium text-slate-700">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
            {allFilteredIds.length > selectedIds.size ? ` de ${allFilteredIds.length} filtrados` : ''}
          </span>
          {allFilteredIds.length > selectedIds.size && (
            <button type="button" className="text-brand-600 underline hover:text-brand-500" onClick={toggleSelectAll}>
              Selecionar todos os {allFilteredIds.length} filtrados
            </button>
          )}
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setConfirmDeleteSelectedOpen(true)}>
            <Trash2 className="h-4 w-4" /> Excluir selecionados
          </Button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Clientes ativos" value={String(activeCount)} icon={<Users2 className="h-4 w-4" />} />
        <StatCard
          label="Receita recorrente mensal"
          value={formatCurrency(portfolio?.monthlyRecurringRevenue)}
          icon={<Wallet className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Risco de churn alto"
          value={String(riskAlto)}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={riskAlto > 0 ? 'danger' : 'neutral'}
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <Table>
          <Thead>
            <Tr>
              {canDelete && (
                <Th className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleSelectAll}
                    aria-label="Selecionar todos os clientes filtrados"
                  />
                </Th>
              )}
              <ColumnFilterHeader
                label="Nome"
                {...sortProps('name')}
                filter={{ kind: 'text', value: textFilters.name, onChange: (v) => setTextFilters((f) => ({ ...f, name: v })) }}
              />
              <ColumnFilterHeader
                label="Documento"
                {...sortProps('document')}
                filter={{ kind: 'text', value: textFilters.document, onChange: (v) => setTextFilters((f) => ({ ...f, document: v })) }}
              />
              <ColumnFilterHeader
                label="Cidade"
                {...sortProps('city')}
                filter={{ kind: 'text', value: textFilters.city, onChange: (v) => setTextFilters((f) => ({ ...f, city: v })) }}
              />
              <ColumnFilterHeader
                label="Plano"
                {...sortProps('planName')}
                filter={{ kind: 'text', value: textFilters.planName, onChange: (v) => setTextFilters((f) => ({ ...f, planName: v })) }}
              />
              <ColumnFilterHeader label="Mensalidade" {...sortProps('monthlyValue')} />
              <ColumnFilterHeader
                label="Status"
                filter={{ kind: 'options', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS }}
              />
              <ColumnFilterHeader
                label="Risco de churn"
                filter={{ kind: 'options', value: riskFilter, onChange: setRiskFilter, options: RISK_OPTIONS }}
              />
              {fieldDefinitions?.map((field) => (
                <ColumnFilterHeader
                  key={field.id}
                  label={field.label}
                  filter={
                    field.type === 'TEXTO'
                      ? {
                          kind: 'text',
                          value: (customFieldFilters[field.key] as string) ?? '',
                          onChange: (v) => setCustomFieldFilters((f) => ({ ...f, [field.key]: v })),
                        }
                      : {
                          kind: 'options',
                          value: Object.entries(customFieldFilters)
                            .filter(([k, v]) => k === field.key && v !== '')
                            .map(([, v]) => String(v)),
                          onChange: (values) =>
                            setCustomFieldFilters((f) => ({
                              ...f,
                              [field.key]: values[0] === undefined ? '' : field.type === 'BOOLEANO' ? values[0] === 'true' : values[0],
                            })),
                          options:
                            field.type === 'BOOLEANO'
                              ? [{ label: 'Sim', value: 'true' }, { label: 'Não', value: 'false' }]
                              : field.options.map((o) => ({ label: o, value: o })),
                        }
                  }
                />
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {!customers?.length && (
              <Tr className="hover:bg-transparent">
                <Td colSpan={7 + (canDelete ? 1 : 0) + (fieldDefinitions?.length ?? 0)} className="py-10 text-center">
                  <EmptyState title="Nenhum cliente encontrado" description="Ajuste os filtros nas colunas acima, ou cadastre/importe clientes." />
                </Td>
              </Tr>
            )}
            {customers?.map((c) => (
              <Tr key={c.id} className="cursor-pointer" onClick={() => setQuickViewId(c.id)}>
                {canDelete && (
                  <Td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelectOne(c.id)}
                      aria-label={`Selecionar ${c.name}`}
                    />
                  </Td>
                )}
                <Td className="font-medium text-slate-900">{c.name}</Td>
                <Td>{formatDocument(c.document)}</Td>
                <Td>{c.city ?? '—'}</Td>
                <Td>{c.planName ?? '—'}</Td>
                <Td>{formatCurrency(c.monthlyValue)}</Td>
                <Td><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></Td>
                <Td>
                  {c.churnRiskLevel ? (
                    <Badge tone={RISK_TONE[c.churnRiskLevel]}>{c.churnRiskLevel} ({c.churnRiskScore})</Badge>
                  ) : (
                    <Badge tone="neutral">Sem dados</Badge>
                  )}
                </Td>
                {fieldDefinitions?.map((field) => {
                  const value = c.customFields?.[field.key];
                  return (
                    <Td key={field.id}>
                      {value == null || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : value}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Novo cliente">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <Label>Nome / Razão social</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>CPF ou CNPJ</Label>
            <Input value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Plano</Label>
              <Input value={form.planName} onChange={(e) => setForm((f) => ({ ...f, planName: e.target.value }))} />
            </div>
            <div>
              <Label>Mensalidade (R$)</Label>
              <Input type="number" step="0.01" min="0" value={form.monthlyValue} onChange={(e) => setForm((f) => ({ ...f, monthlyValue: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" className="w-full" loading={createCustomer.isPending}>
            Cadastrar cliente
          </Button>
        </form>
      </Dialog>

      <CustomerQuickViewModal customerId={quickViewId} onClose={() => setQuickViewId(null)} />
      <ImportCustomersDialog open={importOpen} onClose={() => setImportOpen(false)} />
      {canManageFields && <ManageCustomerFieldsDialog open={fieldsOpen} onClose={() => setFieldsOpen(false)} />}

      <Dialog open={confirmDeleteSelectedOpen} onClose={() => setConfirmDeleteSelectedOpen(false)} title="Excluir clientes selecionados">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Tem certeza que quer excluir <strong>{selectedIds.size}</strong> cliente(s)? Contratos, histórico de
            atendimento e sinais de churn desses clientes também são apagados. Essa ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteSelectedOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={onDeleteSelected} loading={deleteCustomers.isPending}>
              <Trash2 className="h-4 w-4" /> Excluir {selectedIds.size} cliente(s)
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmDeleteAllOpen}
        onClose={() => {
          setConfirmDeleteAllOpen(false);
          setDeleteAllConfirmText('');
        }}
        title="Excluir toda a Carteira de Clientes"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Isso apaga <strong>todos</strong> os clientes desta organização — incluindo os que não aparecem no filtro
            atual — junto com contratos, histórico de atendimento e sinais de churn. <strong>Não pode ser desfeito.</strong>
          </p>
          <div>
            <Label>
              Pra confirmar, digite <strong>EXCLUIR</strong> abaixo
            </Label>
            <Input value={deleteAllConfirmText} onChange={(e) => setDeleteAllConfirmText(e.target.value)} placeholder="EXCLUIR" />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDeleteAllOpen(false);
                setDeleteAllConfirmText('');
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={onDeleteAll}
              disabled={deleteAllConfirmText !== 'EXCLUIR'}
              loading={deleteAllCustomers.isPending}
            >
              <Trash2 className="h-4 w-4" /> Excluir base toda
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
