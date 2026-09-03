import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, Spinner, StatCard } from '@/components/ui/primitives';
import { useCashFlow } from '@/hooks/useFinancial';
import { formatCurrency } from '@/lib/utils';
import {
  chartAxisStroke,
  chartGridStroke,
  chartLegendTextColor,
  chartSeriesColor,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from '@/lib/chart-theme';
import { makeEndValueDot } from '@/components/charts/EndValueDot';
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
            <ComposedChart data={data.series} margin={{ top: 8, right: 92, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartGridStroke} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: chartAxisStroke }} stroke={chartAxisStroke} />
              <YAxis
                tick={{ fontSize: 12, fill: chartAxisStroke }}
                stroke={chartAxisStroke}
                tickFormatter={(v) => `${v / 1000}k`}
              />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={chartTooltipStyle}
                labelStyle={chartTooltipLabelStyle}
                itemStyle={chartTooltipItemStyle}
                cursor={{ fill: 'rgb(var(--slate-300) / 0.15)' }}
              />
              <Legend wrapperStyle={{ color: chartLegendTextColor, fontSize: 13 }} iconType="circle" iconSize={8} />
              <Bar dataKey="receitas" fill={chartSeriesColor.receitas} name="Receitas" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="despesas" fill={chartSeriesColor.despesas} name="Despesas" radius={[4, 4, 0, 0]} barSize={20} />
              <Line
                type="monotone"
                dataKey="saldo"
                name="Saldo"
                stroke={chartSeriesColor.saldo}
                strokeWidth={2}
                dot={makeEndValueDot(chartSeriesColor.saldo, data.series.length, formatCurrency)}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
