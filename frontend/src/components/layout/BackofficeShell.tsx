import type { ReactNode } from 'react';
import { LogOut, Orbit, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { initials } from '@/lib/utils';
import { PRODUCT_NAME } from '@/lib/brand';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/**
 * Layout próprio do backoffice do dono da plataforma — deliberadamente sem
 * o menu de módulos de uma empresa cliente (CRM/Financeiro/Pós-venda...),
 * já que um SUPER_ADMIN nunca acessa dados de negócio de nenhum cliente.
 */
export function BackofficeShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-slate-100 px-4 lg:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-slate-950 shadow-glow">
            <Orbit className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{PRODUCT_NAME}</p>
            <p className="text-[11px] text-slate-500">Backoffice da plataforma</p>
          </div>
        </div>
        <div className="ml-4 flex items-center gap-1.5 rounded-full bg-brand-400/10 px-3 py-1 text-xs font-medium text-brand-300 ring-1 ring-inset ring-brand-400/20">
          <Building2 className="h-3.5 w-3.5" /> Empresas
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">Dono da plataforma</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-400/15 text-sm font-semibold text-brand-300">
            {user ? initials(user.name) : ''}
          </div>
          <ThemeToggle />
          <button
            onClick={() => logout()}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-x-hidden px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
