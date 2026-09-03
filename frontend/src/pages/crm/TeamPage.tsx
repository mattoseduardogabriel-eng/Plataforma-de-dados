import { Trophy } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Spinner, EmptyState } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useTeamPerformance } from '@/hooks/useCrm';
import { formatCurrency } from '@/lib/utils';

export function TeamPage() {
  const { data: team, isLoading } = useTeamPerformance();

  return (
    <div>
      <PageHeader title="Desempenho da Equipe" description="Ranking de vendas, pipeline aberto e atividades por vendedor" />
      {isLoading ? (
        <Spinner />
      ) : !team?.length ? (
        <EmptyState title="Sem dados de equipe" />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>#</Th>
              <Th>Vendedor(a)</Th>
              <Th>Papel</Th>
              <Th>Vendas ganhas</Th>
              <Th>Receita gerada</Th>
              <Th>Pipeline aberto</Th>
              <Th>Atividades concluídas</Th>
              <Th>Atividades pendentes</Th>
            </Tr>
          </Thead>
          <Tbody>
            {team.map((row, idx) => (
              <Tr key={row.userId}>
                <Td>
                  {idx === 0 ? <Trophy className="h-4 w-4 text-amber-500" /> : idx + 1}
                </Td>
                <Td className="font-medium text-slate-900">{row.name}</Td>
                <Td>{row.role}</Td>
                <Td>{row.dealsWon}</Td>
                <Td className="font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(row.revenueWon)}</Td>
                <Td>
                  {row.openDeals} · {formatCurrency(row.openPipelineValue)}
                </Td>
                <Td>{row.activitiesDone}</Td>
                <Td>{row.activitiesPending}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
