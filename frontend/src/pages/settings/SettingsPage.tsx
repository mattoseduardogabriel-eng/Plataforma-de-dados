import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select, Spinner } from '@/components/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { useOrganization, useUpdateOrganization, useOrgUsers, useCreateUser, useUpdateUser } from '@/hooks/useUsers';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';
import { LiroCrmIntegrationCard } from './LiroCrmIntegrationCard';
import { PersonalDataProviderCard } from './PersonalDataProviderCard';
import type { Role } from '@/types';

const ROLES: Role[] = ['ADMIN', 'GESTOR', 'VENDEDOR', 'FINANCEIRO', 'ATENDIMENTO', 'ANALISTA'];

export function SettingsPage() {
  const [tab, setTab] = useState('organizacao');
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const { data: org, isLoading: loadingOrg } = useOrganization();
  const updateOrg = useUpdateOrganization();
  const [orgForm, setOrgForm] = useState({ name: '', cnpj: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (org) setOrgForm({ name: org.name ?? '', cnpj: org.cnpj ?? '' });
  }, [org]);

  const { data: users, isLoading: loadingUsers } = useOrgUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'VENDEDOR' as Role });

  const onSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateOrg.mutateAsync(orgForm);
      toast({ tone: 'success', title: 'Organização atualizada' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao salvar', description: extractErrorMessage(err) });
    }
  };

  const onCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync(userForm);
      toast({ tone: 'success', title: 'Usuário criado' });
      setDialogOpen(false);
      setUserForm({ name: '', email: '', password: '', role: 'VENDEDOR' });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao criar usuário', description: extractErrorMessage(err) });
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    try {
      await updateUser.mutateAsync({ id, active: !active });
    } catch (err) {
      toast({ tone: 'error', title: 'Erro ao atualizar usuário', description: extractErrorMessage(err) });
    }
  };

  return (
    <div>
      <PageHeader title="Configurações" description="Organização, usuários e papéis de acesso" />

      <Tabs value={tab} onChange={setTab} className="mb-4">
        <TabsList>
          <TabsTrigger value="organizacao">Organização</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'organizacao' && (
        <Card className="max-w-lg">
          <CardHeader><CardTitle>Dados da organização</CardTitle></CardHeader>
          <CardContent>
            {loadingOrg ? (
              <Spinner />
            ) : (
              <form onSubmit={onSaveOrg} className="space-y-4">
                <div>
                  <Label>Nome</Label>
                  <Input required disabled={!isAdmin} value={orgForm.name} onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input disabled={!isAdmin} value={orgForm.cnpj} onChange={(e) => setOrgForm((f) => ({ ...f, cnpj: e.target.value }))} />
                </div>
                {isAdmin && (
                  <Button type="submit" loading={updateOrg.isPending}>Salvar</Button>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'usuarios' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Usuários da organização</CardTitle>
            {isAdmin && (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" /> Novo usuário
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <Spinner />
            ) : (
              <div className="space-y-2">
                {users?.map((u) => (
                  <div key={u.id} className="flex items-center justify-between border-b border-slate-50 py-2 text-sm last:border-0">
                    <div>
                      <p className="font-medium text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{u.role}</Badge>
                      <Badge tone={u.active ? 'success' : 'danger'}>{u.active ? 'Ativo' : 'Inativo'}</Badge>
                      {isAdmin && u.id !== currentUser?.id && (
                        <button
                          className="text-xs font-medium text-brand-300 hover:underline"
                          onClick={() => toggleActive(u.id, !!u.active)}
                        >
                          {u.active ? 'Desativar' : 'Ativar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'integracoes' && (
        <div className="space-y-6">
          <PersonalDataProviderCard isAdmin={isAdmin} />
          <LiroCrmIntegrationCard isAdmin={isAdmin} />
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Novo usuário">
        <form onSubmit={onCreateUser} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input required value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" required value={userForm.email} onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Senha temporária</Label>
            <Input type="password" minLength={8} required value={userForm.password} onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <Label>Papel</Label>
            <Select value={userForm.role} onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value as Role }))}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </div>
          <Button type="submit" className="w-full" loading={createUser.isPending}>Criar usuário</Button>
        </form>
      </Dialog>
    </div>
  );
}
