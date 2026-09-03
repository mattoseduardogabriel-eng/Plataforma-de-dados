import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/primitives';
import { AppShell } from './AppShell';

export function ProtectedRoute({ children }: { children: ReactNode }) {
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

  // O dono da plataforma (SUPER_ADMIN) não é usuário de nenhuma empresa
  // cliente — não faz sentido ele acessar CRM/Financeiro/Pós-venda.
  if (user.role === 'SUPER_ADMIN') {
    return <Navigate to="/backoffice" replace />;
  }

  return <AppShell>{children}</AppShell>;
}
