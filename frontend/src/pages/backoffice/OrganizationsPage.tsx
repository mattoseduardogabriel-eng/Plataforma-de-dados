import { useState } from 'react';
import { Plus, Users2, KanbanSquare, UserCog, ShieldOff, ShieldCheck } from 'lucide-react';
import {
  useBackofficeOrganizations,
  useCreateBackofficeOrganization,
  useSetOrganizationStatus,
} from '@/hooks/useBackoffice';
import { Button, Card, Input, Label, Alert, Badge, Spinner, EmptyState } from '@/components/ui/primitives';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';
import { extractErrorMessage } from '@/lib/api';

function CreateOrganizationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createOrg = useCreateBackofficeOrganization();
  const [form, setForm] = useState({
    organizationName: '',
    organizationCnpj: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createOrg.mutateAsync({
        organizationName: form.organizationName,
        organizationCnpj: form.organizationCnpj || undefined,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      setForm({ organizationName: '', organizationCnpj: '', adminName: '', adminEmail: '', adminPassword: '' });
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível criar a empresa.'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nova empresa cliente">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <Label htmlFor="organizationName">Nome da empresa</Label>
          <Input id="organizationName" required value={form.organizationName} onChange={set('organizationName')} placeholder="Franquia Telecom Sul" />
        </div>
        <div>
          <Label htmlFor="organizationCnpj">CNPJ (opcional)</Label>
          <Input id="organizationCnpj" value={form.organizationCnpj} onChange={set('organizationCnpj')} placeholder="00.000.000/0001-00" />
        </div>
        <div className="border-t border-slate-300/60 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Primeiro usuário (ADMIN)</p>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adminName">Nome</Label>
              <Input id="adminName" required value={form.adminName} onChange={set('adminName')} placeholder="Nome do responsável" />
            </div>
            <div>
              <Label htmlFor="adminEmail">E-mail</Label>
              <Input id="adminEmail" type="email" required value={form.adminEmail} onChange={set('adminEmail')} placeholder="responsavel@empresa.com.br" />
            </div>
            <div>
              <Label htmlFor="adminPassword">Senha provisória</Label>
              <Input id="adminPassword" type="text" required minLength={8} value={form.adminPassword} onChange={set('adminPassword')} placeholder="mínimo 8 caracteres" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={createOrg.isPending}>Criar empresa</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function OrganizationsPage() {
  const { data: organizations, isLoading } = useBackofficeOrganizations();
  const setStatus = useSetOrganizationStatus();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Empresas clientes</h1>
          <p className="text-sm text-slate-500">Gerencie as franquias/empresas que usam a plataforma Aster.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Nova empresa
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>Empresa</Th>
                <Th>Usuários</Th>
                <Th>Leads</Th>
                <Th>Clientes</Th>
                <Th>Negócios</Th>
                <Th>Status</Th>
                <Th>Criada em</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <Tr>
                  <Td colSpan={8} className="py-10 text-center"><Spinner className="mx-auto h-6 w-6" /></Td>
                </Tr>
              ) : !organizations || organizations.length === 0 ? (
                <Tr>
                  <Td colSpan={8}>
                    <EmptyState title="Nenhuma empresa cadastrada" description="Crie a primeira empresa cliente da plataforma." />
                  </Td>
                </Tr>
              ) : (
                organizations.map((org) => (
                  <Tr key={org.id}>
                    <Td>
                      <p className="font-medium text-slate-900">{org.name}</p>
                      {org.cnpj && <p className="text-xs text-slate-500">{org.cnpj}</p>}
                    </Td>
                    <Td><span className="inline-flex items-center gap-1.5"><Users2 className="h-3.5 w-3.5 text-slate-400" />{org.counts.users}</span></Td>
                    <Td><span className="inline-flex items-center gap-1.5"><KanbanSquare className="h-3.5 w-3.5 text-slate-400" />{org.counts.leads}</span></Td>
                    <Td><span className="inline-flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5 text-slate-400" />{org.counts.customers}</span></Td>
                    <Td>{org.counts.deals}</Td>
                    <Td>
                      {org.active ? (
                        <Badge tone="success">Ativa</Badge>
                      ) : (
                        <Badge tone="danger">Suspensa</Badge>
                      )}
                    </Td>
                    <Td className="text-slate-500">{new Date(org.createdAt).toLocaleDateString('pt-BR')}</Td>
                    <Td>
                      <Button
                        size="sm"
                        variant={org.active ? 'outline' : 'primary'}
                        loading={setStatus.isPending}
                        onClick={() => setStatus.mutate({ id: org.id, active: !org.active })}
                      >
                        {org.active ? (
                          <><ShieldOff className="h-3.5 w-3.5" /> Suspender</>
                        ) : (
                          <><ShieldCheck className="h-3.5 w-3.5" /> Reativar</>
                        )}
                      </Button>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </div>
      </Card>

      <CreateOrganizationDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
