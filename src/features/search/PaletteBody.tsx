'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { tmdbImage } from '@/features/tmdb/images';
import { groupResults, type PaletteOption } from './palette-options';
import { normalizeQuery } from './query';
import { saveRecent } from './recent';
import { useSearch } from './useSearch';

function Thumb({ option }: { option: PaletteOption }) {
  const src = tmdbImage(option.image, 'w92');
  return (
    <span
      aria-hidden="true"
      className={cn('block h-12 w-8 shrink-0 overflow-hidden bg-ink-700', option.round ? 'size-10 rounded-full' : 'rounded-sm')}
    >
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : null}
    </span>
  );
}

export function PaletteBody({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const uid = useId();
  const listId = `${uid}-list`;
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const { results, status } = useSearch(query);
  const normalized = normalizeQuery(query);

  const groups = useMemo(() => groupResults(results, uid), [results, uid]);
  const options = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const active = options.find((o) => o.id === activeId) ?? null;
  const expanded = normalized !== null && options.length > 0;

  const go = (href: string) => {
    if (normalized) saveRecent(normalized);
    router.push(href);
    onNavigate();
  };

  const move = (delta: 1 | -1) => {
    if (options.length === 0) return;
    const current = active ? options.indexOf(active) : delta === 1 ? -1 : 0;
    setActiveId(options[(current + delta + options.length) % options.length]!.id);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (active) go(active.href);
      else if (normalized) go(`/buscar?q=${encodeURIComponent(normalized)}`);
    }
  };

  return (
    <div className="flex max-h-[min(34rem,80dvh)] flex-col">
      <div className="flex items-center gap-3 border-b border-ink-600 px-4">
        <Search aria-hidden="true" className="size-5 shrink-0 text-ivory-muted" />
        <input
          type="text"
          role="combobox"
          aria-label="Buscar filmes, séries e pessoas"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active?.id}
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscar filmes, séries e pessoas"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveId(null);
          }}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-ivory placeholder:text-ivory-muted focus:outline-none"
        />
        <kbd className="hidden rounded border border-ink-600 px-1.5 text-xs text-ivory-muted sm:block">Esc</kbd>
      </div>

      <div className="overflow-y-auto overscroll-contain">
        <div id={listId} role="listbox" aria-label="Resultados" hidden={!expanded} className="p-2">
          {groups.map((group) => (
            <div key={group.label} role="group" aria-label={group.label}>
              <p aria-hidden="true" className="px-2 pt-2 pb-1 text-xs font-medium tracking-wide text-ivory-muted uppercase">
                {group.label}
              </p>
              {group.options.map((o) => (
                <div
                  key={o.id}
                  id={o.id}
                  role="option"
                  aria-selected={o.id === active?.id}
                  aria-label={o.hint ? `${o.label}, ${o.hint}` : o.label}
                  onClick={() => go(o.href)}
                  onMouseMove={() => o.id !== activeId && setActiveId(o.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5',
                    o.id === active?.id ? 'bg-ink-700' : 'hover:bg-ink-800',
                  )}
                >
                  <Thumb option={o} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ivory">{o.label}</span>
                    {o.hint ? <span className="block text-xs text-ivory-muted">{o.hint}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <p role="status" className="px-4 py-3 text-sm text-ivory-muted empty:hidden">
          {status === 'loading' ? 'Buscando…' : null}
          {status === 'error' ? 'Não foi possível buscar agora.' : null}
          {status === 'success' && options.length === 0 ? `Nada encontrado para "${normalized ?? query.trim()}"` : null}
          {status === 'idle' ? 'Digite ao menos 2 letras. Enter abre todos os resultados.' : null}
        </p>

        {normalized ? (
          <button
            type="button"
            onClick={() => go(`/buscar?q=${encodeURIComponent(normalized)}`)}
            className="w-full border-t border-ink-600 px-4 py-3 text-left text-sm text-amber hover:bg-ink-800"
          >
            Ver todos os resultados
          </button>
        ) : null}
      </div>
    </div>
  );
}
