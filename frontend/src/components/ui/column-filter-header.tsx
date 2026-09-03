import { useEffect, useRef, useState } from 'react';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortDir = 'asc' | 'desc' | null;

interface TextFilter {
  kind: 'text';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface OptionsFilter {
  kind: 'options';
  value: string[];
  onChange: (value: string[]) => void;
  options: { label: string; value: string }[];
}

/**
 * Cabeçalho de coluna com filtro embutido, no mesmo padrão de planilhas
 * corporativas (clica no cabeçalho → dropdown com "Classificar de A a Z /
 * Z a A" + filtro "Contém" ou lista de opções). Cada coluna nova (inclusive
 * campos personalizados) usa o mesmo componente — não é um filtro separado
 * por cima da tabela.
 */
export function ColumnFilterHeader({
  label,
  sortDir,
  onSort,
  filter,
  className,
}: {
  label: string;
  sortDir?: SortDir;
  onSort?: (dir: SortDir) => void;
  filter?: TextFilter | OptionsFilter;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filter?.kind === 'text' ? filter.value : '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (filter?.kind === 'text') setDraft(filter.value);
  }, [filter?.kind === 'text' ? filter.value : undefined]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const hasActiveFilter =
    filter?.kind === 'text' ? !!filter.value : filter?.kind === 'options' ? filter.value.length > 0 : false;
  const isActive = !!sortDir || hasActiveFilter;

  const applyText = () => {
    if (filter?.kind === 'text') filter.onChange(draft);
    setOpen(false);
  };

  const clearAll = () => {
    onSort?.(null);
    if (filter?.kind === 'text') {
      setDraft('');
      filter.onChange('');
    } else if (filter?.kind === 'options') {
      filter.onChange([]);
    }
  };

  const toggleOption = (value: string) => {
    if (filter?.kind !== 'options') return;
    const next = filter.value.includes(value) ? filter.value.filter((v) => v !== value) : [...filter.value, value];
    filter.onChange(next);
  };

  return (
    <th className={cn('relative px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500', className)}>
      <div ref={ref} className="relative inline-block">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-200/60 dark:hover:bg-slate-700/60',
            isActive && 'text-brand-600 dark:text-brand-300',
          )}
        >
          {label}
          {hasActiveFilter && <Filter className="h-3 w-3" />}
          <ChevronDown className="h-3 w-3" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 normal-case shadow-lg dark:border-slate-700 dark:bg-slate-800">
            {onSort && (
              <div className="mb-1 space-y-0.5 border-b border-slate-100 pb-1.5 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => { onSort('asc'); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
                    sortDir === 'asc' && 'font-medium text-brand-600 dark:text-brand-300',
                  )}
                >
                  <ArrowDownAZ className="h-3.5 w-3.5" /> Classificar de A a Z
                </button>
                <button
                  type="button"
                  onClick={() => { onSort('desc'); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700',
                    sortDir === 'desc' && 'font-medium text-brand-600 dark:text-brand-300',
                  )}
                >
                  <ArrowUpZA className="h-3.5 w-3.5" /> Classificar de Z a A
                </button>
              </div>
            )}

            {filter?.kind === 'text' && (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyText()}
                  placeholder={filter.placeholder ?? 'Contém'}
                  className="h-8 flex-1 rounded border border-slate-300 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus:border-brand-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={applyText}
                  title="Aplicar filtro"
                  className="flex h-8 w-8 items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                >
                  ✓
                </button>
              </div>
            )}

            {filter?.kind === 'options' && (
              <div className="max-h-48 space-y-0.5 overflow-auto">
                {filter.options.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm font-normal text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={filter.value.includes(opt.value)}
                      onChange={() => toggleOption(opt.value)}
                      className="h-3.5 w-3.5 rounded border-slate-300"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}

            {(hasActiveFilter || sortDir) && (
              <button
                type="button"
                onClick={clearAll}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded border-t border-slate-100 pt-1.5 text-xs font-normal text-slate-400 hover:text-red-500 dark:border-slate-700"
              >
                <X className="h-3 w-3" /> Limpar filtro
              </button>
            )}
          </div>
        )}
      </div>
    </th>
  );
}
