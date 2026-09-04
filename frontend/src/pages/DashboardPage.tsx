import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Wallet, Users2, ShieldAlert, Target, SlidersHorizontal, ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, StatCard, Spinner, Badge, Button } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';
import { useCrmOverview, useTasksByOperator } from '@/hooks/useCrm';
import { useCashFlow } from '@/hooks/useFinancial';
import { usePortfolioOverview } from '@/hooks/usePostSale';
import { useAuditLogs } from '@/hooks/useReports';
import { useOrganization, useUpdateDashboardWidgets } from '@/hooks/useUsers';
import { useAuth } from '@/lib/auth-context';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import { DASHBOARD_WIDGETS } from '@/lib/dashboard-widgets';
import {
  chartAxisStroke,
  chartCursorStyle,
  chartGridStroke,
  chartLegendTextColor,
  chartSeriesColor,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from '@/lib/chart-theme';
import { makeEndValueDot } from '@/components/charts/EndValueDot';

function CustomizeDashboardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refreshUser } = useAuth();
  const updateWidgets = useUpdateDashboardWidgets();
  const [hidden, setHidden] = useState<string[]>(user?.hiddenDashboardWidgets ?? []);

  const toggle = async (key: string) => {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    setHidden(next);
    await updateWidgets.mutateAsync(next);
    await refreshUser();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Personalizar dashboard">
      <div className="space-y-1.5">
        <p className="mb-2 text-xs text-slate-500">
          Escolha o que aparece no seu dashboard. Sugestão: se "Meta x Produção" não aparece, defina uma meta em
          Configurações → Organização.
        </p>
        {DASHBOARD_WIDGETS.map((w) => (
          <label key={w.key} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!hidden.includes(w.key)}
              onChange={() => toggle(w.key)}
              className="h-4 w-4 rounded border-slate-300"
            />
            {w.label}
          </label>
        ))}
      </div>
      <div className="flex justify-end pt-4">
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </Dialog>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data: overview, isLoading: loadingOverview } = useCrmOverview();
  const { data: cashFlow, isLoading: loadingCashFlow } = useCashFlow(6);
  const { data: portfolio } = usePortfolioOverview();
  const { data: auditLogs } = useAuditLogs();
  const { data: tasksByOperator } = useTasksByOperator();
  const { data: org } = useOrganization();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const riskAlto = portfolio?.byRisk.find((r) => r.level === 'ALTO')?.count ?? 0;
  const hidden = user?.hiddenDashboardWidgets ?? [];
  const show = (key: string) => !hidden.includes(key);

  const goalCents = org?.monthlyGoalCents;
  const producedValue = cashFlow?.summary.paidThisMonthTotal ?? 0;
  const goalValue = goalCents != null ? goalCents / 100 : null;
  const goalPct = goalValue ? Math.min(100, Math.round((producedValue / goalValue) * 100)) : 0;

  return (
    <div>
      <PageHeader
        title={`Bem-vindo(a), ${user?.name?.split(' ')[0]}`}
        description="Visão geral da operação de hoje"
        actions={
          <Button size="sm" variant="outline" onClick={() => setCustomizeOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Personalizar
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {show('pipeline') && (
          <StatCard
            label="Pipeline aberto"
            value={loadingOverview ? '—' : formatCurrency(overview?.open.totalValue)}
            hint={`${overview?.open.count ?? 0} negociações em aberto`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        )}
        {show('conversion') && (
          <StatCard
            label="Taxa de conversão"
            value={loadingOverview ? '—' : `${((overview?.conversionRate ?? 0) * 100).toFixed(0)}%`}
            hint={`${overview?.won.count ?? 0} vendas ganhas`}
            icon={<Users2 className="h-4 w-4" />}
            tone="success"
          />
        )}
        {show('received') && (
          <StatCard
            label="Recebido este mês"
            value={loadingCashFlow ? '—' : formatCurrency(cashFlow?.summary.paidThisMonthTotal)}
            hint={`${cashFlow?.summary.overdueCount ?? 0} lançamento(s) em atraso`}
            icon={<Wallet className="h-4 w-4" />}
            tone="info"
          />
        )}
        {show('churnRisk') && (
          <StatCard
            label="Clientes em risco alto"
            value={String(riskAlto)}
            hint="Risco de cancelamento (churn)"
            icon={<ShieldAlert className="h-4 w-4" />}
            tone={riskAlto > 0 ? 'danger' : 'neutral'}
          />
        )}
      </div>

      {show('goal') && goalValue != null && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" /> Meta x Produção (mês atual)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-end justify-between text-sm">
              <span className="text-slate-600">
                <span className="font-semibold text-slate-900">{formatCurrency(producedValue)}</span> de {formatCurrency(goalValue)}
              </span>
              <span className="font-medium text-slate-600">{goalPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full transition-all', goalPct >= 100 ? 'bg-emerald-500' : 'bg-brand-500')}
                style={{ width: `${goalPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {show('cashFlow') && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Fluxo de caixa (últimos 6 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCashFlow ? (
                <Spinner />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={cashFlow?.series} margin={{ top: 8, right: 92, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="fillReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartSeriesColor.receitas} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={chartSeriesColor.receitas} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartSeriesColor.despesas} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={chartSeriesColor.despesas} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartGridStroke} vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartAxisStroke }} stroke={chartAxisStroke} />
                    <YAxis
                      tick={{ fontSize: 12, fill: chartAxisStroke }}
                      stroke={chartAxisStroke}
                      tickFormatter={(v) => `${v / 1000}k`}
                    />
                    <ReferenceLine y={0} stroke={chartAxisStroke} strokeOpacity={0.5} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={chartTooltipStyle}
                      labelStyle={chartTooltipLabelStyle}
                      itemStyle={chartTooltipItemStyle}
                      cursor={chartCursorStyle}
                    />
                    <Legend
                      wrapperStyle={{ color: chartLegendTextColor, fontSize: 13 }}
                      iconType="circle"
                      iconSize={8}
                    />
                    <Area
                      type="monotone"
                      dataKey="receitas"
                      name="Receitas"
                      stroke={chartSeriesColor.receitas}
                      strokeWidth={2}
                      fill="url(#fillReceitas)"
                      dot={makeEndValueDot(chartSeriesColor.receitas, cashFlow?.series.length ?? 0, formatCurrency)}
                      activeDot={{ r: 5 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="despesas"
                      name="Despesas"
                      stroke={chartSeriesColor.despesas}
                      strokeWidth={2}
                      fill="url(#fillDespesas)"
                      dot={makeEndValueDot(chartSeriesColor.despesas, cashFlow?.series.length ?? 0, formatCurrency)}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo"
                      stroke={chartSeriesColor.saldo}
                      strokeWidth={2}
                      dot={makeEndValueDot(chartSeriesColor.saldo, cashFlow?.series.length ?? 0, formatCurrency)}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {show('funnel') && (
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
        )}
      </div>

      {show('activity') && (
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
      )}

      {show('tasksByOperator') && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Tarefas por operador
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasksByOperator?.length ? (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Operador</Th>
                    <Th>Criadas</Th>
                    <Th>Atribuídas</Th>
                    <Th>Concluídas</Th>
                    <Th>Pendentes</Th>
                    <Th>Atrasadas</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {tasksByOperator.map((row) => (
                    <Tr key={row.userId}>
                      <Td>{row.name}</Td>
                      <Td>{row.criadas}</Td>
                      <Td>{row.atribuidas}</Td>
                      <Td>{row.concluidas}</Td>
                      <Td>{row.pendentes}</Td>
                      <Td className={row.atrasadas > 0 ? 'font-semibold text-red-600' : undefined}>{row.atrasadas}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            ) : (
              <p className="text-sm text-slate-400">Nenhuma tarefa criada ou atribuída ainda.</p>
            )}
          </CardContent>
        </Card>
      )}

      <p className="mt-3 text-xs text-slate-400">
        <Badge tone="neutral">LGPD</Badge> Toda consulta de dado pessoal é registrada com finalidade no log de
        auditoria.
      </p>

      <CustomizeDashboardDialog open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
    </div>
  );
}
