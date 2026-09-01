import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, Menu, X, Database } from 'lucide-react';
import { navGroups } from './nav-config';
import { useAuth } from '@/lib/auth-context';
import { cn, initials } from '@/lib/utils';

function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-slate-900/40 lg:hidden',
          mobileOpen ? 'block' : 'hidden',
        )}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Plataforma de Dados</p>
            <p className="text-[11px] text-slate-400">CRM · Crédito · Inteligência</p>
          </div>
          <button onClick={onCloseMobile} className="ml-auto text-slate-400 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { user, organization, logout } = useAuth();
  return (
    <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 lg:px-6">
      <button onClick={onOpenMobile} className="text-slate-500 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{organization?.name}</p>
        {organization?.cnpj && <p className="text-xs text-slate-400">CNPJ {organization.cnpj}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900">{user?.name}</p>
          <p className="text-xs text-slate-400">{user?.role}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
          {user ? initials(user.name) : ''}
        </div>
        <button
          onClick={() => logout()}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
