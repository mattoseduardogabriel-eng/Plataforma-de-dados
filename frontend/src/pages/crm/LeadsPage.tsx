import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Wallet, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Input, Label, Select, Spinner, Badge, EmptyState } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';
import { useLeads, useCreateLead, useSaveLeadToWallet, useSaveLeadsToWalletBulk } from '@/hooks/useCrm';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { formatDocument, formatDate } from '@/lib/utils';
import type { Lead, LeadStatus } from '@/types';

const STATUS_TONE: Record<LeadStatus, 'neutral' | 'info' | 'danger' | 'success'> = {
  NOVO: 'info',
  QUALIFICANDO: 'neutral',
  DESCARTADO: 'danger',
  CONVERTIDO: 'success',
};

export function LeadsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data: leadsPage, isLoading } = useLeads({ search: search || undefined, status: status || undefined, page });
  const leads = leadsPage?.data;
  const createLead = useCreateLead();
  const saveToWallet = useSaveLeadToWallet();
  const saveManyToWallet = useSaveLeadsToWalletBulk();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', document: '', email: '', phone: '', companyName: '', source: '' });

  // "Salvar na carteira": um lead por vez (com nome editável antes de
  // confirmar) ou vários de uma vez pelo checkbox (usa o nome do lead
  // como está — sem prompt individual, senão vira um por um mesmo).
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [leadParaCarteira, setLeadParaCarteira] = useState<Lead | null>(null);
  const [nomeCarteira, setNomeCarteira] = useState('');

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function abrirSalvarNaCarteira(lead: Lead) {
    setLeadParaCarteira(lead);
    setNomeCarteira(lead.name);
  }

  async function confirmarSalvarNaCarteira(e: React.FormEvent) {
    e.preventDefault();
    if (!leadParaCarteira) return;
    try {
      await saveToWallet.mutateAsync({ id: leadParaCarteira.id, name: nomeCarteira });
      toast({ tone: 'success', title: 'Salvo na carteira de clientes' });
      setLeadParaCarteira(null);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao salvar na carteira', description: extractErrorMessage(err) });
    }
  }

  async function salvarSelecionadosNaCarteira() {
    if (!selecionados.size) return;
    try {
      const resultados = await saveManyToWallet.mutateAsync(Array.from(selecionados).map((leadId) => ({ leadId })));
      const criados = resultados.filter((r) => r.status === 'criado').length;
      const jaExistiam = resultados.filter((r) => r.status === 'ja_estava_na_carteira').length;
      toast({
        tone: 'success',
        title: `${criados} salvo(s) na carteira`,
        description: jaExistiam ? `${jaExistiam} já estava(m) na carteira e foi(ram) ignorado(s).` : undefined,
      });
      setSelecionados(new Set());
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao salvar selecionados na carteira', description: extractErrorMessage(err) });
    }
  }

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lead = await createLead.mutateAsync({
        ...form,
        documentType: form.document.replace(/\D/g, '').length === 14 ? 'CNPJ' : form.document ? 'CPF' : undefined,
      });
      toast({ tone: 'success', title: 'Lead cadastrado' });
      setDialogOpen(false);
      navigate(`/crm/leads/${lead.id}`);
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao cadastrar lead', description: extractErrorMessage(err) });
    }
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Qualificação de prospecções antes de avançar no funil"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Novo lead
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou documento"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          className="w-48"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os status</option>
          <option value="NOVO">Novo</option>
          <option value="QUALIFICANDO">Qualificando</option>
          <option value="CONVERTIDO">Convertido</option>
          <option value="DESCARTADO">Descartado</option>
        </Select>
        {selecionados.size > 0 && (
          <Button variant="secondary" onClick={salvarSelecionadosNaCarteira} loading={saveManyToWallet.isPending}>
            <Wallet className="h-4 w-4" /> Salvar {selecionados.size} na carteira
          </Button>
        )}
      </Card>

      {isLoading ? (
        <Spinner />
      ) : !leads?.length ? (
        <EmptyState title="Nenhum lead encontrado" description="Cadastre um novo lead para começar a qualificar prospecções." />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th className="w-8"></Th>
              <Th>Nome</Th>
              <Th>Documento</Th>
              <Th>Contato</Th>
              <Th>Origem</Th>
              <Th>Responsável</Th>
              <Th>Status</Th>
              <Th>Criado em</Th>
              <Th>Carteira</Th>
            </Tr>
          </Thead>
          <Tbody>
            {leads.map((lead) => (
              <Tr key={lead.id} className="cursor-pointer" onClick={() => navigate(`/crm/leads/${lead.id}`)}>
                <Td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selecionados.has(lead.id)}
                    onChange={() => toggleSelecionado(lead.id)}
                    disabled={!!lead.customer}
                    title={lead.customer ? 'Já está na carteira' : 'Selecionar'}
                  />
                </Td>
                <Td className="font-medium text-slate-900">{lead.name}</Td>
                <Td>{formatDocument(lead.document)}</Td>
                <Td>{lead.email || lead.phone || '—'}</Td>
                <Td>{lead.source || '—'}</Td>
                <Td>{lead.assignedTo?.name ?? '—'}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[lead.status]}>{lead.status}</Badge>
                </Td>
                <Td>{formatDate(lead.createdAt)}</Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  {lead.customer ? (
                    <Badge tone="success">
                      <Check className="h-3 w-3" /> Na carteira
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => abrirSalvarNaCarteira(lead)}>
                      <Wallet className="h-4 w-4" /> Salvar na carteira
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {leadsPage && leadsPage.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            Página {leadsPage.page} de {leadsPage.totalPages} — {leadsPage.total} lead(s) no total
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={leadsPage.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={leadsPage.page >= leadsPage.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Novo lead">
        <form onSubmit={onCreate} className="space-y-4">
          <div>
            <Label>Nome / Razão social</Label>
            <Input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>CPF ou CNPJ</Label>
            <Input value={form.document} onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))} />
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
            <Label>Empresa</Label>
            <Input value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} />
          </div>
          <div>
            <Label>Origem</Label>
            <Input placeholder="Indicação, site, evento..." value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
          </div>
          <Button type="submit" className="w-full" loading={createLead.isPending}>
            Cadastrar lead
          </Button>
        </form>
      </Dialog>

      <Dialog open={!!leadParaCarteira} onClose={() => setLeadParaCarteira(null)} title="Salvar na carteira de clientes">
        <form onSubmit={confirmarSalvarNaCarteira} className="space-y-4">
          <p className="text-sm text-slate-500">
            Cria um cliente ativo em Pós-venda a partir deste lead — confirme ou corrija o nome antes de salvar
            (contato vindo do WhatsApp às vezes só tem o número).
          </p>
          <div>
            <Label>Nome</Label>
            <Input required autoFocus value={nomeCarteira} onChange={(e) => setNomeCarteira(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" loading={saveToWallet.isPending}>
            <Wallet className="h-4 w-4" /> Salvar na carteira
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
