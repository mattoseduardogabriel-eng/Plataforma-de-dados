import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, Select, Input, Spinner, Badge, EmptyState, Button } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useDataQueryHistory } from '@/hooks/useDataIntelligence';
import { useOrgUsers } from '@/hooks/useUsers';
import { formatDateTime, formatDocument } from '@/lib/utils';
import type { DataQueryHistoryItem, DataQueryType } from '@/types';
import { RegisterCustomerFromQueryDialog } from './RegisterCustomerFromQueryDialog';

const PAGE_SIZE = 50;

export function HistoryPage() {
  const [type, setType] = useState<DataQueryType | ''>('');
  const [targetDocument, setTargetDocument] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [purpose, setPurpose] = useState('');
  const [requestedById, setRequestedById] = useState('');
  const [page, setPage] = useState(0);
  const { data: usuarios } = useOrgUsers();
  const { data, isLoading } = useDataQueryHistory({
    type: type || undefined,
    targetDocument: targetDocument || undefined,
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    purpose: purpose || undefined,
    requestedById: requestedById || undefined,
    skip: page * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const [registeringFrom, setRegisteringFrom] = useState<DataQueryHistoryItem | null>(null);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function comFiltroNovo<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(0);
      setter(v);
    };
  }

  return (
    <div>
      <PageHeader title="Histórico de Consultas" description="Todas as consultas de dados, com finalidade registrada para auditoria LGPD" />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Select className="w-56" value={type} onChange={(e) => comFiltroNovo(setType)(e.target.value as DataQueryType | '')}>
          <option value="">Todos os tipos</option>
          <option value="CNPJ">CNPJ</option>
          <option value="CPF">CPF</option>
          <option value="TELEFONE">Telefone</option>
          <option value="CREDITO">Crédito</option>
          <option value="PARENTES">Parentes</option>
        </Select>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Documento/telefone</label>
          <Input
            className="w-48"
            placeholder="Busca parcial"
            value={targetDocument}
            onChange={(e) => comFiltroNovo(setTargetDocument)(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">De</label>
          <Input type="date" value={dataInicio} onChange={(e) => comFiltroNovo(setDataInicio)(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Até</label>
          <Input type="date" value={dataFim} onChange={(e) => comFiltroNovo(setDataFim)(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Finalidade</label>
          <Input
            className="w-48"
            placeholder="Busca parcial"
            value={purpose}
            onChange={(e) => comFiltroNovo(setPurpose)(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Solicitado por</label>
          <Select className="w-48" value={requestedById} onChange={(e) => comFiltroNovo(setRequestedById)(e.target.value)}>
            <option value="">Todos os usuários</option>
            {usuarios?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.active === false ? ' (inativo)' : ''}
              </option>
            ))}
          </Select>
        </div>
        {(type || targetDocument || dataInicio || dataFim || purpose || requestedById) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setType('');
              setTargetDocument('');
              setDataInicio('');
              setDataFim('');
              setPurpose('');
              setRequestedById('');
              setPage(0);
            }}
          >
            Limpar filtros
          </Button>
        )}
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

      {data && data.total > PAGE_SIZE && (
        <div className="mt-3 flex items-center gap-3 text-sm text-neutral-500">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>
            Página {page + 1} de {totalPaginas} ({data.total} ao todo)
          </span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPaginas} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}

      <RegisterCustomerFromQueryDialog
        key={registeringFrom?.id ?? 'none'}
        item={registeringFrom}
        onClose={() => setRegisteringFrom(null)}
      />
    </div>
  );
}
