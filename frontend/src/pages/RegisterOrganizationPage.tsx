import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Database } from 'lucide-react';
import { useAuth, extractErrorMessage } from '@/lib/auth-context';
import { Button, Card, Input, Label, Alert } from '@/components/ui/primitives';

export function RegisterOrganizationPage() {
  const { registerOrganization, user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    organizationName: '',
    organizationCnpj: '',
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerOrganization(form);
      navigate('/');
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível criar a organização.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Database className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Criar organização</h1>
          <p className="text-sm text-slate-500">
            Comece com um funil de vendas, política de crédito padrão e usuário administrador.
          </p>
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <div>
              <Label htmlFor="organizationName">Nome da franquia/empresa</Label>
              <Input id="organizationName" required value={form.organizationName} onChange={set('organizationName')} />
            </div>
            <div>
              <Label htmlFor="organizationCnpj">CNPJ (opcional)</Label>
              <Input id="organizationCnpj" value={form.organizationCnpj} onChange={set('organizationCnpj')} />
            </div>
            <div>
              <Label htmlFor="name">Seu nome</Label>
              <Input id="name" required value={form.name} onChange={set('name')} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={form.email} onChange={set('email')} />
            </div>
            <div>
              <Label htmlFor="password">Senha (mín. 8 caracteres)</Label>
              <Input id="password" type="password" minLength={8} required value={form.password} onChange={set('password')} />
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              Criar organização
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
