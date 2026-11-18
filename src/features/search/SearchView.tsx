'use client';

import { Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { normalizeQuery, searchHref } from './query';
import { clearRecent, saveRecent, useRecentSearches } from './recent';
import { SearchResults, type SearchTab } from './SearchResults';

const TABS: { id: SearchTab; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'movie', label: 'Filmes' },
  { id: 'tv', label: 'Séries' },
  { id: 'person', label: 'Pessoas' },
];

export function SearchView() {
  const urlQuery = useSearchParams().get('q') ?? '';
  const [value, setValue] = useState(urlQuery);
  const [tab, setTab] = useState<SearchTab>('all');
  const recent = useRecentSearches();
  const input = useRef<HTMLInputElement>(null);
  const pushed = useRef(urlQuery);

  // Autofocus on mobile only; never steal focus on desktop.
  useEffect(() => {
    if (window.matchMedia?.('(max-width: 767px)').matches) input.current?.focus();
  }, []);

  // URL changed from outside (back/forward, recent search link): follow it.
  useEffect(() => {
    if (urlQuery !== pushed.current) {
      pushed.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  // Input -> URL (debounced).
  useEffect(() => {
    const next = value.trim();
    if (next === pushed.current) return;
    const id = setTimeout(() => {
      pushed.current = next;
      // Next's App Router syncs useSearchParams with history.replaceState, without an RSC round trip.
      window.history.replaceState(null, '', searchHref(next));
    }, 250);
    return () => clearTimeout(id);
  }, [value]);

  const query = normalizeQuery(urlQuery);

  const commit = (term: string) => {
    const q = normalizeQuery(term);
    if (q) saveRecent(q);
  };

  return (
    <div>
      <form
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          commit(value);
        }}
        className="relative"
      >
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 size-6 -translate-y-1/2 text-ivory-muted" />
        <input
          ref={input}
          type="search"
          name="q"
          aria-label="Buscar filmes, séries e pessoas"
          placeholder="Buscar filmes, séries e pessoas"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-16 w-full rounded-full border border-ink-600 bg-ink-800 pr-6 pl-14 font-display text-2xl text-ivory placeholder:text-ivory-muted focus:border-amber focus:outline-none md:h-20 md:text-3xl"
        />
      </form>

      {query ? (
        <>
          <div role="group" aria-label="Filtrar por tipo" className="mt-6 mb-6 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'h-9 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber motion-reduce:transition-none',
                  tab === t.id ? 'border-amber bg-amber text-ink-950' : 'border-ink-600 text-ivory-muted hover:text-ivory',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <SearchResults query={query} tab={tab} />
        </>
      ) : (
        <div className="mt-10 text-center">
          <h2 className="font-display text-3xl text-ivory">Comece a digitar</h2>
          <p className="mt-2 text-ivory-muted">Filmes, séries e pessoas, com no mínimo 2 letras.</p>
          {recent.length > 0 ? (
            <section aria-labelledby="recentes" className="mx-auto mt-8 max-w-xl">
              <div className="flex items-center justify-between">
                <h3 id="recentes" className="text-sm font-medium text-ivory-muted">Buscas recentes</h3>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-sm text-ivory-muted hover:text-ivory"
                >
                  Limpar
                </button>
              </div>
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {recent.map((term) => (
                  <li key={term}>
                    <button
                      type="button"
                      onClick={() => setValue(term)}
                      className="rounded-full border border-ink-600 px-4 py-1.5 text-sm text-ivory hover:border-amber"
                    >
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
