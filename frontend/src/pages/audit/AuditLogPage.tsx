import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Card, Input, Label, Spinner, Badge, EmptyState } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useAuditLogs } from '@/hooks/useReports';
import { formatDateTime } from '@/lib/utils';

export function AuditLogPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data, isLoading } = useAuditLogs({ from: from || undefined, to: to || undefined });

  return (
    <div>
      <PageHeader title="Log de Auditoria (LGPD)" description="Registro de todas as ações e consultas de dados pessoais realizadas na plataforma" />

      <Alert tone="info" className="mb-4">
        Toda consulta de CNPJ, CPF, telefone, crédito ou vínculos exige finalidade declarada e fica registrada aqui —
        quem consultou, o quê, quando e por quê.
      </Alert>

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div>
          <Label className="mb-1">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="mb-1">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="Nenhum registro de auditoria" />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Ação</Th>
              <Th>Entidade</Th>
              <Th>Finalidade</Th>
              <Th>Usuário</Th>
              <Th>Quando</Th>
            </Tr>
          </Thead>
          <Tbody>
            {data.items.map((log) => (
              <Tr key={log.id}>
                <Td><Badge tone="neutral">{log.action.replaceAll('_', ' ')}</Badge></Td>
                <Td>{log.entityType}</Td>
                <Td className="max-w-xs truncate" title={log.purpose ?? ''}>{log.purpose ?? '—'}</Td>
                <Td>{log.user?.name ?? 'Sistema'}</Td>
                <Td>{formatDateTime(log.createdAt)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
