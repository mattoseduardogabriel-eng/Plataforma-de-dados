import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, Spinner, StatCard } from '@/components/ui/primitives';
import { useCashFlow } from '@/hooks/useFinancial';
import { formatCurrency } from '@/lib/utils';
import { Wallet, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

export function CashFlowPage() {
  const { data, isLoading } = useCashFlow(6);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Fluxo de Caixa" description="Receitas e despesas consolidadas dos últimos 6 meses" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Recebido este mês"
          value={formatCurrency(data.summary.paidThisMonthTotal)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="A receber (pendente)"
          value={formatCurrency(data.summary.pendingReceivablesTotal)}
          hint={`${data.summary.pendingReceivablesCount} lançamento(s)`}
          icon={<Wallet className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="Em atraso"
          value={String(data.summary.overdueCount)}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={data.summary.overdueCount > 0 ? 'danger' : 'neutral'}
        />
        <StatCard label="Período" value="6 meses" icon={<Clock className="h-4 w-4" />} tone="neutral" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receitas x Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="receitas" fill="#22c55e" name="Receitas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="#ef4444" name="Despesas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
