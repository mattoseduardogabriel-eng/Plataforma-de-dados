import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSearch } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Spinner, EmptyState } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useGenerateReport, useReports } from '@/hooks/useReports';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatDateTime, formatDocument } from '@/lib/utils';
import type { ReportTargetType } from '@/types';

export function CrossReferencePage() {
  const generate = useGenerateReport();
  const { data: reports, isLoading } = useReports();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ targetDocument: '', targetType: 'CNPJ' as ReportTargetType, purpose: '' });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const report = await generate.mutateAsync(form);
      toast({ tone: 'success', title: 'Relatório de cruzamento gerado' });
      navigate(`/relatorios/${report.id}`);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao gerar relatório', description: extractErrorMessage(err) });
    }
  };

  return (
    <div>
      <PageHeader
        title="Cruzamento de Dados"
        description="Combina dados internos (CRM, financeiro, pós-venda) com conectores externos em um relatório único"
      />

      <Card>
        <CardHeader><CardTitle>Novo cruzamento</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.targetType} onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value as ReportTargetType }))}>
                <option value="CNPJ">CNPJ</option>
                <option value="CPF">CPF</option>
              </Select>
            </div>
            <div>
              <Label>Documento</Label>
              <Input required value={form.targetDocument} onChange={(e) => setForm((f) => ({ ...f, targetDocument: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Finalidade (LGPD)</Label>
              <Input required placeholder="Due diligence antes de contrato" value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" loading={generate.isPending}>
                <FileSearch className="h-4 w-4" /> Gerar cruzamento
              </Button>
            </div>
          </form>
          {generate.isError && (
            <Alert tone="danger" title="Erro" className="mt-4">{extractErrorMessage(generate.error)}</Alert>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>Relatórios gerados</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <Spinner />
          ) : !reports?.length ? (
            <EmptyState title="Nenhum relatório gerado ainda" />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Título</Th>
                  <Th>Documento</Th>
                  <Th>Tipo</Th>
                  <Th>Gerado por</Th>
                  <Th>Quando</Th>
                </Tr>
              </Thead>
              <Tbody>
                {reports.map((r) => (
                  <Tr key={r.id} className="cursor-pointer" onClick={() => navigate(`/relatorios/${r.id}`)}>
                    <Td className="font-medium text-slate-900">{r.title}</Td>
                    <Td>{formatDocument(r.targetDocument)}</Td>
                    <Td>{r.targetType}</Td>
                    <Td>{r.createdBy?.name}</Td>
                    <Td>{formatDateTime(r.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
