'use client';

import { useRouter } from 'next/navigation';
import { useId } from 'react';
import type { SeasonSummary } from '@/features/tmdb/types';
import { seasonLabel } from './seasons';

/** Mobile season picker: a labelled native select that navigates without scrolling. */
export function SeasonSelect({
  seasons,
  current,
  baseHref,
}: {
  seasons: SeasonSummary[];
  current: number;
  baseHref: string;
}) {
  const router = useRouter();
  const id = useId();
  return (
    <div className="flex items-center gap-3 sm:hidden">
      <label htmlFor={id} className="text-sm font-medium text-ivory-muted">
        Temporada
      </label>
      <select
        id={id}
        value={current}
        onChange={(e) => router.push(`${baseHref}?temporada=${e.target.value}`, { scroll: false })}
        className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-ivory focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        {seasons.map((s) => (
          <option key={s.seasonNumber} value={s.seasonNumber}>
            {seasonLabel(s)}
          </option>
        ))}
      </select>
    </div>
  );
}
