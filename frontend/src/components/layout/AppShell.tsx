import { type ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, Menu, X, Orbit, KeyRound } from 'lucide-react';
import { navGroups } from './nav-config';
import { useAuth } from '@/lib/auth-context';
import { useEffectiveFeatures } from '@/hooks/useFeatures';
import { cn, initials } from '@/lib/utils';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/brand';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';

function Sidebar({ mobileOpen, onCloseMobile }: { mobileOpen: boolean; onCloseMobile: () => void }) {
  // Sem dado ainda (carregando) mostra tudo — evita o menu "piscar" vazio;
  // depois que carrega, itens de ferramenta desligada somem.
  const { data: effectiveFeatures } = useEffectiveFeatures();
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.featureKey || !effectiveFeatures || effectiveFeatures.includes(item.featureKey)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden',
          mobileOpen ? 'block' : 'hidden',
        )}
        onClick={onCloseMobile}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-slate-100 transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-300/60 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-slate-950 shadow-glow">
            <Orbit className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{PRODUCT_NAME}</p>
            <p className="text-[11px] text-slate-500">{PRODUCT_TAGLINE}</p>
          </div>
          <button onClick={onCloseMobile} className="ml-auto text-slate-400 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
                          ? 'bg-brand-400/10 text-brand-300 ring-1 ring-inset ring-brand-400/20'
                          : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900',
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
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  return (
    <header className="flex h-16 items-center gap-4 border-b border-slate-200 bg-slate-100 px-4 lg:px-6">
      <button onClick={onOpenMobile} className="text-slate-500 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{organization?.name}</p>
        {organization?.cnpj && <p className="text-xs text-slate-500">CNPJ {organization.cnpj}</p>}
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-slate-900">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.role}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-400/15 text-sm font-semibold text-brand-300">
          {user ? initials(user.name) : ''}
        </div>
        <ThemeToggle />
        <button
          onClick={() => setChangePasswordOpen(true)}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          title="Trocar senha"
        >
          <KeyRound className="h-4 w-4" />
        </button>
        <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
        <button
          onClick={() => logout()}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
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
