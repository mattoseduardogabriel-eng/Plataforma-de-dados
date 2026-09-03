import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Orbit } from 'lucide-react';
import { useAuth, extractErrorMessage } from '@/lib/auth-context';
import { Button, Card, Input, Label, Alert } from '@/components/ui/primitives';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PRODUCT_NAME } from '@/lib/brand';

export function LoginPage() {
  const { login, loginTwoFactor, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preenchido só quando a conta tem 2FA ligado — a resposta de
  // POST /auth/login vem sem token de acesso ainda, só um pendingToken
  // pra completar em POST /auth/login/2fa.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [totpToken, setTotpToken] = useState('');

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resultado = await login({ email, password });
      if (resultado?.twoFactorRequired) {
        setPendingToken(resultado.pendingToken);
        return;
      }
      navigate('/');
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível entrar. Verifique suas credenciais.'));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(totpToken)) {
      setError('Digite o código de 6 dígitos do app autenticador.');
      return;
    }
    setSubmitting(true);
    try {
      await loginTwoFactor(pendingToken!, totpToken);
      navigate('/');
    } catch (err) {
      setError(extractErrorMessage(err, 'Código inválido ou expirado.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingToken) {
    return (
      <div className="star-field relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-500/20 blur-[100px]" />
        <div className="relative w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-slate-950 shadow-glow">
              <Orbit className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Verificação em duas etapas</h1>
            <p className="text-sm text-slate-500">Digite o código de 6 dígitos do seu app autenticador.</p>
          </div>
          <Card className="p-6">
            <form onSubmit={onSubmitTwoFactor} className="space-y-4">
              {error && <Alert tone="danger">{error}</Alert>}
              <div>
                <Label htmlFor="totp">Código</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  className="text-center text-lg tracking-[0.5em]"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                />
              </div>
              <Button type="submit" className="w-full" loading={submitting}>
                Confirmar
              </Button>
              <button
                type="button"
                onClick={() => { setPendingToken(null); setTotpToken(''); setError(null); }}
                className="w-full text-center text-sm text-slate-500 hover:underline"
              >
                Voltar
              </button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="star-field relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-500/20 blur-[100px]" />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-slate-950 shadow-glow">
            <Orbit className="h-5 w-5" />
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> plataforma de dados
          </span>
          <h1 className="text-2xl font-bold text-slate-900">{PRODUCT_NAME}</h1>
          <p className="text-sm text-slate-500">CRM, financeiro, pós-venda e inteligência de dados</p>
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              Entrar
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-slate-500">
          Ainda não tem uma organização?{' '}
          <Link to="/registrar" className="font-medium text-brand-300 hover:underline">
            Criar agora
          </Link>
        </p>
      </div>
    </div>
  );
}
