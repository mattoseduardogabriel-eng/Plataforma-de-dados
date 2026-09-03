import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/primitives';
import { BackofficeShell } from './BackofficeShell';

export function BackofficeRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Só o dono da plataforma acessa o backoffice — qualquer usuário de
  // empresa cliente é mandado de volta pro dashboard dela.
  if (user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <BackofficeShell>{children}</BackofficeShell>;
}
