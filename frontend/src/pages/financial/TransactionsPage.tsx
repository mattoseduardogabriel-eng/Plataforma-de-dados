import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Input, Label, Select, Spinner, Badge, EmptyState } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { ColumnFilterHeader } from '@/components/ui/column-filter-header';
import { Dialog } from '@/components/ui/dialog';
import { useTransactions, useCreateTransaction, useUpdateTransaction, useCategories, useCreateCategory } from '@/hooks/useFinancial';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { FinanceType, Transaction, TransactionStatus } from '@/types';

const STATUS_TONE: Record<TransactionStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  PENDENTE: 'warning',
  PAGO: 'success',
  ATRASADO: 'danger',
  CANCELADO: 'neutral',
};

const TYPE_OPTIONS = [
  { label: 'Receita', value: 'RECEITA' },
  { label: 'Despesa', value: 'DESPESA' },
];

const STATUS_OPTIONS = [
  { label: 'Pendente', value: 'PENDENTE' },
  { label: 'Pago', value: 'PAGO' },
  { label: 'Atrasado', value: 'ATRASADO' },
  { label: 'Cancelado', value: 'CANCELADO' },
];

interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export function TransactionsPage() {
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState | null>(null);

  const { data: transactions, isLoading } = useTransactions({
    description: descriptionFilter,
    type: typeFilter,
    status: statusFilter,
    categoryId: categoryFilter,
    sortBy: sort?.key,
    sortDir: sort?.dir,
  });
  const { data: categories } = useCategories();

  const sortProps = (key: string) => ({
    sortDir: sort?.key === key ? sort.dir : null,
    onSort: (dir: 'asc' | 'desc' | null) => setSort(dir ? { key, dir } : null),
  });
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const createCategory = useCreateCategory();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'RECEITA' as FinanceType,
    description: '',
    amount: '',
    dueDate: '',
    categoryId: '',
  });
  const [newCategory, setNewCategory] = useState('');

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [editForm, setEditForm] = useState({
    description: '',
    amount: '',
    dueDate: '',
    categoryId: '',
    status: 'PENDENTE' as TransactionStatus,
  });

  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setEditForm({
      description: tx.description,
      amount: String(tx.amount),
      dueDate: tx.dueDate.slice(0, 10),
      categoryId: tx.category?.id ?? '',
      status: tx.status,
    });
  };

  const onSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await updateTransaction.mutateAsync({
        id: editing.id,
        description: editForm.description,
        amount: Number(editForm.amount),
        dueDate: editForm.dueDate,
        categoryId: editForm.categoryId || null,
        status: editForm.status,
      });
      toast({ tone: 'success', title: 'Lançamento atualizado' });
      setEditing(null);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao atualizar lançamento', description: extractErrorMessage(err) });
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTransaction.mutateAsync({
        ...form,
        amount: Number(form.amount),
        categoryId: form.categoryId || undefined,
      });
      toast({ tone: 'success', title: 'Lançamento criado' });
      setDialogOpen(false);
      setForm({ type: 'RECEITA', description: '', amount: '', dueDate: '', categoryId: '' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao criar lançamento', description: extractErrorMessage(err) });
    }
  };

  const onCreateCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      const category = await createCategory.mutateAsync({ name: newCategory, type: form.type });
      setForm((f) => ({ ...f, categoryId: category.id }));
      setNewCategory('');
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao criar categoria', description: extractErrorMessage(err) });
    }
  };

  const markPaid = async (id: string) => {
    try {
      await updateTransaction.mutateAsync({ id, status: 'PAGO' });
      toast({ tone: 'success', title: 'Lançamento marcado como pago' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao atualizar', description: extractErrorMessage(err) });
    }
  };

  return (
    <div>
      <PageHeader
        title="Lançamentos Financeiros"
        description="Receitas e despesas da operação"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Novo lançamento
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <ColumnFilterHeader
                label="Descrição"
                {...sortProps('description')}
                filter={{ kind: 'text', value: descriptionFilter, onChange: setDescriptionFilter }}
              />
              <ColumnFilterHeader
                label="Categoria"
                filter={{
                  kind: 'options',
                  value: categoryFilter,
                  onChange: setCategoryFilter,
                  options: (categories ?? []).map((c) => ({ label: c.name, value: c.id })),
                }}
              />
              <ColumnFilterHeader
                label="Tipo"
                {...sortProps('type')}
                filter={{ kind: 'options', value: typeFilter, onChange: setTypeFilter, options: TYPE_OPTIONS }}
              />
              <ColumnFilterHeader label="Valor" {...sortProps('amount')} />
              <ColumnFilterHeader label="Vencimento" {...sortProps('dueDate')} />
              <ColumnFilterHeader
                label="Status"
                {...sortProps('status')}
                filter={{ kind: 'options', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS }}
              />
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {!transactions?.length && (
              <Tr className="hover:bg-transparent">
                <Td colSpan={7} className="py-10 text-center">
                  <EmptyState title="Nenhum lançamento encontrado" description="Ajuste os filtros nas colunas acima, ou registre um novo lançamento." />
                </Td>
              </Tr>
            )}
            {transactions?.map((tx) => (
              <Tr key={tx.id}>
                <Td className="font-medium text-slate-900">{tx.description}</Td>
                <Td>{tx.category?.name ?? '—'}</Td>
                <Td>
                  <Badge tone={tx.type === 'RECEITA' ? 'success' : 'danger'}>{tx.type}</Badge>
                </Td>
                <Td className={tx.type === 'RECEITA' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                  {formatCurrency(tx.amount)}
                </Td>
                <Td>{formatDate(tx.dueDate)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[tx.status]}>{tx.status}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center gap-3">
                    {tx.status === 'PENDENTE' && (
                      <button className="text-xs font-medium text-brand-300 hover:underline" onClick={() => markPaid(tx.id)}>
                        Marcar como pago
                      </button>
                    )}
                    <button
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
                      onClick={() => openEdit(tx)}
                      title="Editar lançamento"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Novo lançamento">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FinanceType }))}>
              <option value="RECEITA">Receita</option>
              <option value="DESPESA">Despesa</option>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" required value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <div className="flex gap-2">
              <Select className="flex-1" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
                <option value="">Sem categoria</option>
                {categories?.filter((c) => c.type === form.type).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="mt-2 flex gap-2">
              <Input placeholder="Nova categoria" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              <Button type="button" variant="outline" onClick={onCreateCategory}>
                Adicionar
              </Button>
            </div>
          </div>
          <Button type="submit" className="w-full" loading={createTransaction.isPending}>
            Criar lançamento
          </Button>
        </form>
      </Dialog>

      <Dialog open={!!editing} onClose={() => setEditing(null)} title="Editar lançamento">
        <form onSubmit={onSaveEdit} className="space-y-4">
          <div>
            <Label>Descrição</Label>
            <Input
              required
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={editForm.amount}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input
                type="date"
                required
                value={editForm.dueDate}
                onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select
              value={editForm.categoryId}
              onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
            >
              <option value="">Sem categoria</option>
              {categories?.filter((c) => c.type === editing?.type).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as TransactionStatus }))}
            >
              <option value="PENDENTE">Pendente</option>
              <option value="PAGO">Pago</option>
              <option value="ATRASADO">Atrasado</option>
              <option value="CANCELADO">Cancelado</option>
            </Select>
          </div>
          <Button type="submit" className="w-full" loading={updateTransaction.isPending}>
            Salvar alterações
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
