import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp, Wallet, Users2, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, StatCard, Spinner, Badge } from '@/components/ui/primitives';
import { useCrmOverview } from '@/hooks/useCrm';
import { useCashFlow } from '@/hooks/useFinancial';
import { usePortfolioOverview } from '@/hooks/usePostSale';
import { useAuditLogs } from '@/hooks/useReports';
import { useAuth } from '@/lib/auth-context';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';

export function DashboardPage() {
  const { user } = useAuth();
  const { data: overview, isLoading: loadingOverview } = useCrmOverview();
  const { data: cashFlow, isLoading: loadingCashFlow } = useCashFlow(6);
  const { data: portfolio } = usePortfolioOverview();
  const { data: auditLogs } = useAuditLogs();

  const riskAlto = portfolio?.byRisk.find((r) => r.level === 'ALTO')?.count ?? 0;

  return (
    <div>
      <PageHeader title={`Bem-vindo(a), ${user?.name?.split(' ')[0]}`} description="Visão geral da operação de hoje" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pipeline aberto"
          value={loadingOverview ? '—' : formatCurrency(overview?.open.totalValue)}
          hint={`${overview?.open.count ?? 0} negociações em aberto`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Taxa de conversão"
          value={loadingOverview ? '—' : `${((overview?.conversionRate ?? 0) * 100).toFixed(0)}%`}
          hint={`${overview?.won.count ?? 0} vendas ganhas`}
          icon={<Users2 className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Recebido este mês"
          value={loadingCashFlow ? '—' : formatCurrency(cashFlow?.summary.paidThisMonthTotal)}
          hint={`${cashFlow?.summary.overdueCount ?? 0} lançamento(s) em atraso`}
          icon={<Wallet className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="Clientes em risco alto"
          value={String(riskAlto)}
          hint="Risco de cancelamento (churn)"
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={riskAlto > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Fluxo de caixa (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCashFlow ? (
              <Spinner />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={cashFlow?.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="receitas" stroke="#22c55e" strokeWidth={2} name="Receitas" />
                  <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} name="Despesas" />
                  <Line type="monotone" dataKey="saldo" stroke="#6366f1" strokeWidth={2} name="Saldo" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funil de vendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview?.funnel.map((stage) => (
              <div key={stage.stageId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.colorHex }} />
                  <span className="text-slate-700">{stage.stageName}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">{stage.count}</p>
                  <p className="text-xs text-slate-400">{formatCurrency(stage.totalValue)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Atividade recente (auditoria)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {auditLogs?.items.slice(0, 8).map((log) => (
            <div key={log.id} className="flex items-center justify-between border-b border-slate-50 py-2 text-sm last:border-0">
              <div>
                <p className="font-medium text-slate-800">{log.action.replaceAll('_', ' ')}</p>
                <p className="text-xs text-slate-400">
                  {log.user?.name ?? 'Sistema'} · {log.entityType}
                  {log.purpose ? ` · finalidade: ${log.purpose}` : ''}
                </p>
              </div>
              <span className={cn('shrink-0 text-xs text-slate-400')}>{formatDateTime(log.createdAt)}</span>
            </div>
          ))}
          {!auditLogs?.items.length && <p className="text-sm text-slate-400">Nenhuma atividade registrada ainda.</p>}
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        <Badge tone="neutral">LGPD</Badge> Toda consulta de dado pessoal é registrada com finalidade no log de
        auditoria.
      </p>
    </div>
  );
}
