import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Alert, Badge, Button, EmptyState } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useImportCustomers, type ImportCustomersResult } from '@/hooks/usePostSale';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';

interface ParsedRow {
  name: string;
  document?: string;
  documentType?: 'CPF' | 'CNPJ';
  email?: string;
  phone?: string;
  city?: string;
  planName?: string;
  monthlyValue?: number;
}

// Aceita várias variações de cabeçalho em português — planilha do usuário
// não precisa seguir um formato rígido.
const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  nome: 'name',
  'nome/razão social': 'name',
  'razão social': 'name',
  cliente: 'name',
  documento: 'document',
  cpf: 'document',
  cnpj: 'document',
  'cpf/cnpj': 'document',
  email: 'email',
  'e-mail': 'email',
  telefone: 'phone',
  celular: 'phone',
  fone: 'phone',
  cidade: 'city',
  municipio: 'city', // normalizeHeader() já remove acento, então cobre "município" também
  plano: 'planName',
  'plano contratado': 'planName',
  mensalidade: 'monthlyValue',
  valor: 'monthlyValue',
  'valor mensal': 'monthlyValue',
};

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function parseSheet(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const parsed: ParsedRow[] = rows
          .map((row) => {
            const mapped: Partial<ParsedRow> = {};
            for (const [key, value] of Object.entries(row)) {
              const field = HEADER_ALIASES[normalizeHeader(key)];
              if (!field || value === '' || value == null) continue;
              if (field === 'monthlyValue') {
                const num = typeof value === 'number' ? value : Number(String(value).replace(/\./g, '').replace(',', '.'));
                if (!Number.isNaN(num)) mapped.monthlyValue = num;
              } else {
                (mapped as any)[field] = String(value).trim();
              }
            }
            if (mapped.document) {
              const digits = mapped.document.replace(/\D/g, '');
              mapped.documentType = digits.length === 14 ? 'CNPJ' : digits.length === 11 ? 'CPF' : undefined;
              mapped.document = digits || undefined;
            }
            return mapped as ParsedRow;
          })
          .filter((r) => r.name);

        resolve(parsed);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Planilha inválida.'));
      }
    };
    reader.readAsBinaryString(file);
  });
}

export function ImportCustomersDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportCustomersResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importCustomers = useImportCustomers();
  const { toast } = useToast();

  const reset = () => {
    setRows([]);
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onClosePopup = () => {
    reset();
    onClose();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setParseError(null);
    try {
      const parsed = await parseSheet(file);
      if (!parsed.length) {
        setParseError('Nenhuma linha reconhecida. Confira se a planilha tem uma coluna de nome preenchida.');
        return;
      }
      setRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erro ao ler a planilha.');
    }
  };

  const onImport = async () => {
    try {
      const outcome = await importCustomers.mutateAsync(rows as unknown as Record<string, unknown>[]);
      setResult(outcome);
      toast({
        tone: 'success',
        title: 'Importação concluída',
        description: `${outcome.created} criado(s), ${outcome.updated} atualizado(s)${outcome.errors.length ? `, ${outcome.errors.length} com erro` : ''}.`,
      });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao importar', description: extractErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onClose={onClosePopup} title="Importar clientes por planilha" className="max-w-3xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Aceita <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.xlsx</code>,{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.xls</code> ou{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.csv</code>. Colunas reconhecidas: Nome,
          CPF/CNPJ, E-mail, Telefone, Plano, Mensalidade — em qualquer ordem, com esses nomes ou variações comuns.
          Clientes existentes (mesmo documento) são atualizados; os demais são criados.
        </p>

        {!rows.length && !result && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-8 text-center hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
            <FileSpreadsheet className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Clique para escolher o arquivo</span>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
          </label>
        )}

        {parseError && <Alert tone="danger">{parseError}</Alert>}

        {rows.length > 0 && !result && (
          <>
            <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Nome</Th>
                    <Th>Documento</Th>
                    <Th>Telefone</Th>
                    <Th>Plano</Th>
                    <Th>Mensalidade</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.slice(0, 200).map((r, i) => (
                    <Tr key={i}>
                      <Td>{r.name}</Td>
                      <Td>{r.document ?? '—'}</Td>
                      <Td>{r.phone ?? '—'}</Td>
                      <Td>{r.planName ?? '—'}</Td>
                      <Td>{r.monthlyValue ?? '—'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
            <div className="flex items-center justify-between">
              <Badge tone="neutral">{rows.length} linha(s) reconhecida(s)</Badge>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>Escolher outro arquivo</Button>
                <Button onClick={onImport} loading={importCustomers.isPending}>
                  <Upload className="h-4 w-4" /> Importar {rows.length} cliente(s)
                </Button>
              </div>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Badge tone="success">{result.created} criado(s)</Badge>
              <Badge tone="neutral">{result.updated} atualizado(s)</Badge>
              {result.errors.length > 0 && <Badge tone="danger">{result.errors.length} com erro</Badge>}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-red-600 dark:text-red-400">
                    Linha {e.row} ({e.name ?? 'sem nome'}): {e.message}
                  </p>
                ))}
              </div>
            )}
            {!result.errors.length && <EmptyState title="Tudo certo" description="Todas as linhas foram importadas com sucesso." />}
            <Button className="w-full" onClick={onClosePopup}>Fechar</Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
