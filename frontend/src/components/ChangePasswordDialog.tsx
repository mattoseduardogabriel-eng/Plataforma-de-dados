import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Input, Label, Alert } from '@/components/ui/primitives';
import { useChangePassword } from '@/hooks/useChangePassword';
import { extractErrorMessage } from '@/lib/api';

export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const changePassword = useChangePassword();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const close = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError(null);
    setDone(false);
    onClose();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.newPassword !== form.confirmPassword) {
      setError('A confirmação não bate com a senha nova.');
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setDone(true);
    } catch (err) {
      setError(extractErrorMessage(err, 'Não foi possível trocar a senha.'));
    }
  };

  return (
    <Dialog open={open} onClose={close} title="Trocar minha senha">
      {done ? (
        <div className="space-y-4">
          <Alert tone="success">
            Senha alterada! Suas outras sessões/dispositivos foram desconectados por segurança — só este continua logado.
          </Alert>
          <div className="flex justify-end">
            <Button onClick={close}>Fechar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <div>
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input
              id="currentPassword"
              type="password"
              required
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="newPassword">Senha nova</Label>
            <Input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirmar senha nova</Label>
            <Input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
            <Button type="submit" loading={changePassword.isPending}>Trocar senha</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
