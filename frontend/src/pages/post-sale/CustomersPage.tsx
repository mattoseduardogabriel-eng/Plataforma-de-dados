import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Input, Label, Select, Spinner, Badge, EmptyState, StatCard } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';
import { useCustomers, useCreateCustomer, usePortfolioOverview } from '@/hooks/usePostSale';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatCurrency, formatDocument } from '@/lib/utils';
import type { ChurnRiskLevel, CustomerStatus } from '@/types';
import { Users2, ShieldAlert, Wallet } from 'lucide-react';

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

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const { data: customers, isLoading } = useCustomers({ search: search || undefined, churnRiskLevel: riskFilter || undefined });
  const { data: portfolio } = usePortfolioOverview();
  const createCustomer = useCreateCustomer();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', planName: '', monthlyValue: '' });

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
      navigate(`/pos-venda/${customer.id}`);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao cadastrar cliente', description: extractErrorMessage(err) });
    }
  };

  return (
    <div>
      <PageHeader
        title="Carteira de Clientes"
        description="Relacionamento e retenção — clientes ativos após conversão no funil de vendas"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        }
      />

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

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar por nome ou documento" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select className="w-48" value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
          <option value="">Todos os riscos</option>
          <option value="BAIXO">Risco baixo</option>
          <option value="MEDIO">Risco médio</option>
          <option value="ALTO">Risco alto</option>
        </Select>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !customers?.length ? (
        <EmptyState title="Nenhum cliente" description="Clientes são criados automaticamente ao ganhar uma negociação no CRM, ou cadastre manualmente." />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Documento</Th>
              <Th>Plano</Th>
              <Th>Mensalidade</Th>
              <Th>Status</Th>
              <Th>Risco de churn</Th>
            </Tr>
          </Thead>
          <Tbody>
            {customers.map((c) => (
              <Tr key={c.id} className="cursor-pointer" onClick={() => navigate(`/pos-venda/${c.id}`)}>
                <Td className="font-medium text-slate-900">{c.name}</Td>
                <Td>{formatDocument(c.document)}</Td>
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
    </div>
  );
}
