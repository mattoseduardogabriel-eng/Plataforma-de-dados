import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, Select, Spinner, Badge, EmptyState, Button } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useDataQueryHistory } from '@/hooks/useDataIntelligence';
import { formatDateTime, formatDocument } from '@/lib/utils';
import type { DataQueryHistoryItem, DataQueryType } from '@/types';
import { RegisterCustomerFromQueryDialog } from './RegisterCustomerFromQueryDialog';

export function HistoryPage() {
  const [type, setType] = useState<DataQueryType | ''>('');
  const { data, isLoading } = useDataQueryHistory({ type: type || undefined });
  const [registeringFrom, setRegisteringFrom] = useState<DataQueryHistoryItem | null>(null);

  return (
    <div>
      <PageHeader title="Histórico de Consultas" description="Todas as consultas de dados, com finalidade registrada para auditoria LGPD" />

      <Card className="mb-4 flex items-center gap-3 p-4">
        <Select className="w-56" value={type} onChange={(e) => setType(e.target.value as DataQueryType | '')}>
          <option value="">Todos os tipos</option>
          <option value="CNPJ">CNPJ</option>
          <option value="CPF">CPF</option>
          <option value="TELEFONE">Telefone</option>
          <option value="CREDITO">Crédito</option>
          <option value="PARENTES">Parentes</option>
        </Select>
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !data?.items.length ? (
        <EmptyState title="Nenhuma consulta registrada" />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Tipo</Th>
              <Th>Documento/Alvo</Th>
              <Th>Finalidade</Th>
              <Th>Provedor</Th>
              <Th>Solicitado por</Th>
              <Th>Quando</Th>
              <Th />
            </Tr>
          </Thead>
          <Tbody>
            {data.items.map((item) => (
              <Tr key={item.id}>
                <Td><Badge tone="neutral">{item.type}</Badge></Td>
                <Td>{formatDocument(item.targetDocument)}</Td>
                <Td className="max-w-xs truncate" title={item.purpose}>{item.purpose}</Td>
                <Td>
                  <Badge tone={item.isDemoData ? 'warning' : 'success'}>{item.provider}</Badge>
                </Td>
                <Td>{item.requestedBy?.name}</Td>
                <Td>{formatDateTime(item.createdAt)}</Td>
                <Td>
                  {(item.type === 'CNPJ' || item.type === 'CPF') && (
                    <Button size="sm" variant="outline" onClick={() => setRegisteringFrom(item)}>
                      <UserPlus className="h-3.5 w-3.5" /> Cadastrar cliente
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <RegisterCustomerFromQueryDialog
        key={registeringFrom?.id ?? 'none'}
        item={registeringFrom}
        onClose={() => setRegisteringFrom(null)}
      />
    </div>
  );
}
