import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Button, Input, Label, Select, Spinner, EmptyState } from '@/components/ui/primitives';
import { useCustomerFieldDefinitions, useCreateCustomerFieldDefinition, useDeleteCustomerFieldDefinition } from '@/hooks/usePostSale';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import type { CustomFieldType } from '@/types';

const TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXTO: 'Texto',
  BOOLEANO: 'Sim / Não',
  LISTA: 'Lista de opções',
};

export function ManageCustomerFieldsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: fields, isLoading } = useCustomerFieldDefinitions();
  const create = useCreateCustomerFieldDefinition();
  const remove = useDeleteCustomerFieldDefinition();
  const { toast } = useToast();

  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('TEXTO');
  const [optionsText, setOptionsText] = useState('');

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        label,
        type,
        options: type === 'LISTA' ? optionsText.split(',').map((o) => o.trim()).filter(Boolean) : undefined,
      });
      toast({ tone: 'success', title: 'Campo criado', description: 'Já aparece como coluna e filtro na Carteira de Clientes.' });
      setLabel('');
      setOptionsText('');
      setType('TEXTO');
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao criar campo', description: extractErrorMessage(err) });
    }
  };

  const onRemove = async (id: string, fieldLabel: string) => {
    if (!confirm(`Remover o campo "${fieldLabel}"? Os valores já preenchidos ficam guardados, mas o campo some da tela.`)) return;
    try {
      await remove.mutateAsync(id);
      toast({ tone: 'success', title: 'Campo removido' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao remover campo', description: extractErrorMessage(err) });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Campos personalizados da Carteira de Clientes" className="max-w-xl">
      <div className="space-y-5">
        <p className="text-sm text-slate-500">
          Cada campo criado aqui vira automaticamente uma coluna com filtro na Carteira de Clientes e um campo
          editável no cadastro do cliente.
        </p>

        <form onSubmit={onCreate} className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="grid grid-cols-[1fr_160px] gap-2">
            <div>
              <Label>Nome do campo</Label>
              <Input required placeholder="Ex.: Cliente novo" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
                <option value="TEXTO">Texto</option>
                <option value="BOOLEANO">Sim / Não</option>
                <option value="LISTA">Lista de opções</option>
              </Select>
            </div>
          </div>
          {type === 'LISTA' && (
            <div>
              <Label>Opções (separadas por vírgula)</Label>
              <Input
                required
                placeholder="Ex.: Residencial, Empresarial, Governo"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </div>
          )}
          <Button type="submit" size="sm" loading={create.isPending}>
            <Plus className="h-4 w-4" /> Adicionar campo
          </Button>
        </form>

        {isLoading ? (
          <Spinner />
        ) : !fields?.length ? (
          <EmptyState title="Nenhum campo personalizado" description="Crie o primeiro campo acima." />
        ) : (
          <div className="space-y-2">
            {fields.map((field) => (
              <div key={field.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 dark:border-slate-700">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{field.label}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Badge tone="neutral">{TYPE_LABELS[field.type]}</Badge>
                    {field.type === 'LISTA' && (
                      <span className="text-xs text-slate-400">{field.options.join(', ')}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(field.id, field.label)}
                  className="text-slate-400 hover:text-red-500"
                  title="Remover campo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
