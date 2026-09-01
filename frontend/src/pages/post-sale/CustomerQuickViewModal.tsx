import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Alert, Badge, Button, Input, Label, Select, Spinner } from '@/components/ui/primitives';
import { useCustomer, useUpdateCustomer, useCustomerFieldDefinitions } from '@/hooks/usePostSale';
import { useDataQuery } from '@/hooks/useDataIntelligence';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatCurrency, formatDate, formatDocument } from '@/lib/utils';
import { openLiroCrmConversation } from '@/lib/liro-crm';
import type { CustomerStatus } from '@/types';

const STATUS_TONE: Record<CustomerStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  ATIVO: 'success',
  INATIVO: 'neutral',
  SUSPENSO: 'warning',
  CANCELADO: 'danger',
};

const CNPJ_SITUACAO_TONE: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
  ATIVA: 'success',
  BAIXADA: 'danger',
  SUSPENSA: 'warning',
  INAPTA: 'warning',
  NULA: 'danger',
};

export function CustomerQuickViewModal({ customerId, onClose }: { customerId: string | null; onClose: () => void }) {
  const { data: customer, isLoading } = useCustomer(customerId ?? undefined);
  const { data: fieldDefinitions } = useCustomerFieldDefinitions();
  const updateCustomer = useUpdateCustomer();
  const cnpjQuery = useDataQuery('cnpj');
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [customFieldsForm, setCustomFieldsForm] = useState<Record<string, string | boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name ?? '',
        email: customer.email ?? '',
        phone: customer.phone ?? '',
        city: customer.city ?? '',
        planName: customer.planName ?? '',
        monthlyValue: customer.monthlyValue != null ? String(customer.monthlyValue) : '',
        status: customer.status ?? 'ATIVO',
      });
      setCustomFieldsForm(customer.customFields ?? {});
    }
  }, [customer]);

  if (!customerId) return null;

  const onSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCustomer.mutateAsync({
        id: customerId,
        ...form,
        monthlyValue: form.monthlyValue ? Number(form.monthlyValue) : null,
        customFields: customFieldsForm,
      });
      toast({ tone: 'success', title: 'Cliente atualizado' });
      setEditing(false);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao salvar', description: extractErrorMessage(err) });
    }
  };

  const onRequeryCnpj = async () => {
    if (!customer?.document) return;
    try {
      await cnpjQuery.mutateAsync({
        document: customer.document,
        purpose: 'Verificação periódica de situação cadastral do cliente',
      });
      toast({ tone: 'success', title: 'CNPJ reconsultado' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao consultar CNPJ', description: extractErrorMessage(err) });
    }
  };

  const onOpenLiro = async () => {
    const result = await openLiroCrmConversation(customer?.phone);
    if (result === 'copied') {
      toast({ tone: 'success', title: 'Telefone copiado', description: 'Cole na busca do painel do Liro CRM que abriu numa nova aba.' });
    } else {
      toast({ tone: 'error', title: 'Cliente sem telefone cadastrado' });
    }
  };

  const onCopyField = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
    } catch {
      toast({ tone: 'error', title: 'Não foi possível copiar', description: 'Seu navegador bloqueou o acesso à área de transferência.' });
    }
  };

  // Pequeno botão de copiar ao lado de um campo — copia o valor cru (sem
  // máscara/formatação), pra colar em outro sistema sem arrastar pontuação.
  const CopyBtn = ({ field, value }: { field: string; value?: string | null }) =>
    value ? (
      <button
        type="button"
        onClick={() => onCopyField(field, value)}
        className="text-slate-400 hover:text-brand-600 dark:hover:text-brand-300"
        title={`Copiar ${field}`}
      >
        {copiedField === field ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    ) : null;

  // Linha compacta ícone + valor + ações (ex.: copiar) — mesmo padrão de
  // "ficha de cliente" de CRM (rótulo implícito no ícone, sem tomar espaço).
  const InfoRow = ({
    icon,
    value,
    children,
  }: {
    icon: React.ReactNode;
    value: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-2 py-0.5 text-slate-700 dark:text-slate-200">
      <span className="text-slate-400">{icon}</span>
      <span className="flex-1 truncate font-medium">{value}</span>
      {children}
    </div>
  );

  const cnpjResult = cnpjQuery.data?.data as
    | { situacaoCadastral?: string; dataSituacaoCadastral?: string | null; razaoSocial?: string }
    | undefined;

  return (
    <Dialog open={!!customerId} onClose={onClose} title={customer?.name ?? 'Cliente'} className="max-w-2xl">
      {isLoading || !customer ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[customer.status as CustomerStatus]}>{customer.status}</Badge>
            {customer.documentType && <Badge tone="neutral">{customer.documentType}</Badge>}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>
                <Pencil className="h-3.5 w-3.5" /> {editing ? 'Cancelar edição' : 'Editar'}
              </Button>
              <Link
                to={`/pos-venda/${customer.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Página completa <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {editing ? (
            <form onSubmit={onSaveEdit} className="space-y-3">
              <div>
                <Label>Nome / Razão social</Label>
                <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plano</Label>
                  <Input value={form.planName} onChange={(e) => setForm((f) => ({ ...f, planName: e.target.value }))} />
                </div>
                <div>
                  <Label>Mensalidade (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.monthlyValue} onChange={(e) => setForm((f) => ({ ...f, monthlyValue: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="SUSPENSO">Suspenso</option>
                  <option value="CANCELADO">Cancelado</option>
                </Select>
              </div>

              {!!fieldDefinitions?.length && (
                <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-700">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Campos personalizados</p>
                  {fieldDefinitions.map((field) => (
                    <div key={field.id}>
                      <Label>{field.label}</Label>
                      {field.type === 'TEXTO' && (
                        <Input
                          value={(customFieldsForm[field.key] as string) ?? ''}
                          onChange={(e) => setCustomFieldsForm((f) => ({ ...f, [field.key]: e.target.value }))}
                        />
                      )}
                      {field.type === 'BOOLEANO' && (
                        <Select
                          value={customFieldsForm[field.key] === true ? 'true' : customFieldsForm[field.key] === false ? 'false' : ''}
                          onChange={(e) => setCustomFieldsForm((f) => ({ ...f, [field.key]: e.target.value === 'true' }))}
                        >
                          <option value="">—</option>
                          <option value="true">Sim</option>
                          <option value="false">Não</option>
                        </Select>
                      )}
                      {field.type === 'LISTA' && (
                        <Select
                          value={(customFieldsForm[field.key] as string) ?? ''}
                          onChange={(e) => setCustomFieldsForm((f) => ({ ...f, [field.key]: e.target.value }))}
                        >
                          <option value="">—</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Button type="submit" className="w-full" loading={updateCustomer.isPending}>
                Salvar alterações
              </Button>
            </form>
          ) : (
            <div className="space-y-1.5 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              <InfoRow icon={<FileText className="h-4 w-4" />} value={customer.name}>
                <CopyBtn field="nome" value={customer.name} />
              </InfoRow>
              {customer.document && (
                <InfoRow icon={<Building2 className="h-4 w-4" />} value={formatDocument(customer.document)}>
                  <CopyBtn field="documento" value={customer.document} />
                </InfoRow>
              )}
              {customer.city && <InfoRow icon={<MapPin className="h-4 w-4" />} value={customer.city} />}
              {customer.email && (
                <InfoRow icon={<Mail className="h-4 w-4" />} value={customer.email}>
                  <CopyBtn field="e-mail" value={customer.email} />
                </InfoRow>
              )}
              {customer.phone && (
                <InfoRow
                  icon={<Phone className="h-4 w-4" />}
                  value={
                    <button type="button" onClick={onOpenLiro} className="hover:underline" title="Abrir conversa no Liro CRM">
                      {customer.phone}
                    </button>
                  }
                >
                  <CopyBtn field="telefone" value={customer.phone} />
                </InfoRow>
              )}
              {customer.planName && (
                <InfoRow icon={<Package className="h-4 w-4" />} value={`${customer.planName} — ${formatCurrency(customer.monthlyValue)}/mês`} />
              )}
              {customer.contractStartDate && (
                <InfoRow icon={<Calendar className="h-4 w-4" />} value={`Cliente desde ${formatDate(customer.contractStartDate)}`} />
              )}
            </div>
          )}

          {!editing && !!fieldDefinitions?.length && (
            <div className="flex flex-wrap gap-1.5">
              {fieldDefinitions.map((field) => {
                const value = customer.customFields?.[field.key];
                if (value == null || value === '') return null;
                return (
                  <Badge key={field.id} tone="neutral">
                    {field.label}: {typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : value}
                  </Badge>
                );
              })}
            </div>
          )}

          {customer.documentType === 'CNPJ' && customer.document && !editing && (
            <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Situação cadastral (Receita Federal)</p>
                <Button size="sm" variant="outline" onClick={onRequeryCnpj} loading={cnpjQuery.isPending}>
                  <RefreshCw className="h-3.5 w-3.5" /> Reconsultar CNPJ
                </Button>
              </div>
              {cnpjResult?.situacaoCadastral && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Badge tone={CNPJ_SITUACAO_TONE[cnpjResult.situacaoCadastral] ?? 'neutral'}>
                    {cnpjResult.situacaoCadastral}
                  </Badge>
                  {cnpjResult.dataSituacaoCadastral && (
                    <span className="text-xs text-slate-400">desde {formatDate(cnpjResult.dataSituacaoCadastral)}</span>
                  )}
                </div>
              )}
              {cnpjQuery.isError && (
                <Alert tone="danger" className="mt-2">
                  {extractErrorMessage(cnpjQuery.error)}
                </Alert>
              )}
            </div>
          )}

          {!editing && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Contratos', count: (customer as any).contracts?.length ?? 0 },
                { label: 'Interações', count: (customer as any).interactions?.length ?? 0 },
                { label: 'Lançamentos', count: (customer as any).transactions?.length ?? 0 },
              ].map((section) => (
                <Link
                  key={section.label}
                  to={`/pos-venda/${customer.id}`}
                  className="rounded-lg border border-slate-200 p-2.5 text-center hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{section.count}</p>
                  <p className="text-xs text-slate-400">{section.label}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
