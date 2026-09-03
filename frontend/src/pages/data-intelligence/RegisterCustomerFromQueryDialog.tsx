import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Input, Label, Alert } from '@/components/ui/primitives';
import { useCreateCustomer } from '@/hooks/usePostSale';
import { extractErrorMessage } from '@/lib/api';
import type { DataQueryHistoryItem } from '@/types';

/** Extração best-effort do nome/cidade a partir do resultado salvo da consulta — os
 * conectores (BrasilAPI pra CNPJ, mocks/provedor real pra CPF) usam nomes de campo
 * diferentes, então tentamos os mais prováveis em vez de exigir digitação manual. */
function extractDefaults(item: DataQueryHistoryItem) {
  const data = (item.resultJson ?? {}) as Record<string, unknown>;
  const name =
    (data.razaoSocial as string) ||
    (data.nomeFantasia as string) ||
    (data.nomeSimulado as string) ||
    (data.nome as string) ||
    (data.name as string) ||
    '';
  const endereco = data.endereco as Record<string, unknown> | undefined;
  const city = (endereco?.municipio as string) || (data.municipio as string) || (data.cidade as string) || '';
  return { name, city };
}

export function RegisterCustomerFromQueryDialog({
  item,
  onClose,
}: {
  item: DataQueryHistoryItem | null;
  onClose: () => void;
}) {
  const createCustomer = useCreateCustomer();
  const defaults = item ? extractDefaults(item) : { name: '', city: '' };
  const [form, setForm] = useState({ name: defaults.name, city: defaults.city });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!item) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createCustomer.mutateAsync({
        name: form.name,
        city: form.city || undefined,
        document: item.targetDocument,
        documentType: item.type === 'CPF' ? 'CPF' : item.type === 'CNPJ' ? 'CNPJ' : undefined,
      });
      setDone(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível cadastrar o cliente.'));
    }
  };

  return (
    <Dialog open={!!item} onClose={onClose} title="Cadastrar cliente a partir da consulta">
      {done ? (
        <div className="space-y-4">
          <Alert tone="success">Cliente cadastrado! Você já pode encontrá-lo na Carteira de Clientes.</Alert>
          <div className="flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <p className="text-xs text-slate-500">
            Documento: <span className="font-medium text-slate-700">{item.targetDocument}</span> (preenchido
            automaticamente a partir da consulta; confira o nome antes de salvar).
          </p>
          <div>
            <Label htmlFor="customerName">Nome / Razão social</Label>
            <Input
              id="customerName"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nome do cliente"
            />
          </div>
          <div>
            <Label htmlFor="customerCity">Cidade</Label>
            <Input
              id="customerCity"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={createCustomer.isPending}>Cadastrar cliente</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
