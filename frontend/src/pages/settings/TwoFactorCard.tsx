import { useState } from 'react';
import { Alert, Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Spinner } from '@/components/ui/primitives';
import { useTwoFactorStatus, useSetupTwoFactor, useEnableTwoFactor, useDisableTwoFactor, type TwoFactorSetup } from '@/hooks/useTwoFactor';
import { useToast } from '@/components/ui/toast';
import { extractErrorMessage } from '@/lib/auth-context';

// Autenticação em duas etapas (TOTP) — só ADMIN/GESTOR (ver
// TwoFactorController no backend, mesmo nível de acesso de configuração
// sensível da empresa).
export function TwoFactorCard() {
  const { data: status, isLoading } = useTwoFactorStatus();
  const setup = useSetupTwoFactor();
  const enable = useEnableTwoFactor();
  const disable = useDisableTwoFactor();
  const { toast } = useToast();

  const [setupData, setSetupData] = useState<TwoFactorSetup | null>(null);
  const [confirmToken, setConfirmToken] = useState('');

  const [showDisable, setShowDisable] = useState(false);
  const [disableToken, setDisableToken] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSetup = async () => {
    setError(null);
    try {
      setSetupData(await setup.mutateAsync());
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const onConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await enable.mutateAsync(confirmToken);
      setSetupData(null);
      setConfirmToken('');
      toast({ tone: 'success', title: '2FA ativado' });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const onDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await disable.mutateAsync({ token: disableToken || undefined, password: disablePassword || undefined });
      setShowDisable(false);
      setDisableToken('');
      setDisablePassword('');
      toast({ tone: 'success', title: '2FA desativado' });
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle>Autenticação em duas etapas (2FA)</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-slate-500">
          Depois de ligada, todo login nessa conta pede a senha e um código de 6 dígitos gerado por um app
          autenticador (Google Authenticator, Authy, 1Password etc), mesmo que alguém descubra sua senha.
        </p>

        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

        {isLoading ? (
          <Spinner />
        ) : setupData ? (
          <form onSubmit={onConfirm} className="space-y-4">
            <p className="text-sm text-slate-600">
              Escaneie o QR code no seu app autenticador e digite o código de 6 dígitos que ele mostrar.
            </p>
            <img src={setupData.qrCodeDataUrl} alt="QR code do 2FA" className="mx-auto h-44 w-44" />
            <p className="break-all text-center text-xs text-slate-400">
              Não consegue escanear? Digite manualmente: <code>{setupData.secret}</code>
            </p>
            <Input
              inputMode="numeric"
              autoFocus
              maxLength={6}
              className="text-center text-lg tracking-[0.5em]"
              value={confirmToken}
              onChange={(e) => setConfirmToken(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => { setSetupData(null); setConfirmToken(''); }}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" loading={enable.isPending} disabled={confirmToken.length !== 6}>
                Ativar 2FA
              </Button>
            </div>
          </form>
        ) : status?.enabled ? (
          <div>
            <p className="mb-3 text-sm font-medium text-emerald-600">✓ 2FA ativado na sua conta.</p>
            {!showDisable ? (
              <Button variant="outline" onClick={() => setShowDisable(true)}>Desativar 2FA</Button>
            ) : (
              <form onSubmit={onDisable} className="space-y-3">
                <p className="text-xs text-slate-500">
                  Confirme com o código do app autenticador ou sua senha (útil se perdeu o celular).
                </p>
                <div>
                  <Label>Código de 6 dígitos (opcional)</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    value={disableToken}
                    onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div>
                  <Label>Sua senha (opcional)</Label>
                  <Input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setShowDisable(false); setDisableToken(''); setDisablePassword(''); }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" loading={disable.isPending}>
                    Confirmar desativação
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <Button onClick={onSetup} loading={setup.isPending}>Ativar 2FA</Button>
        )}
      </CardContent>
    </Card>
  );
}
