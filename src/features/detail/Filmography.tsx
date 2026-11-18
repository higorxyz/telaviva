'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/ui/EmptyState';
import { FilmographyRow } from './FilmographyRow';
import type { CreditFilter, YearGroup } from './person';

const OPTIONS: Array<{ value: CreditFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'acting', label: 'Atuação' },
  { value: 'crew', label: 'Equipe' },
];

/** Year-grouped credits with a client-side Todos / Atuação / Equipe filter (no URL state). */
export function Filmography({ groups }: { groups: Record<CreditFilter, YearGroup[]> }) {
  const [filter, setFilter] = useState<CreditFilter>('all');
  const visible = groups[filter];

  return (
    <div>
      <div role="group" aria-label="Filtrar filmografia" className="mb-6 inline-flex rounded-full border border-ink-600 bg-ink-900 p-1">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={filter === o.value}
            onClick={() => setFilter(o.value)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
              filter === o.value ? 'bg-amber text-ink-950' : 'text-ivory-muted hover:text-ivory',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState title="Nada por aqui" description="Nenhum crédito nesta categoria." />
      ) : (
        <div className="space-y-6">
          {visible.map((group) => (
            <section key={group.year} aria-label={group.year} className="grid gap-x-8 gap-y-1 border-t border-ink-700 pt-4 md:grid-cols-[6rem_1fr]">
              <h3 className="font-display text-2xl text-amber">{group.year}</h3>
              <ul className="divide-y divide-ink-800">
                {group.items.map((c) => (
                  <FilmographyRow key={`${c.mediaType}:${c.id}`} credit={c} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
