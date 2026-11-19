import { formatRating } from '@/lib/format';
import type { LibraryStats as Stats } from './library-query';

/**
 * An editorial strip of figures: three columns on phones (all six in view, no scroller that needs a tab stop) and
 * six on desktop.
 */
export function LibraryStats({ stats }: { stats: Stats }) {
  const figures: [string, string][] = [
    ['Filmes assistidos', String(stats.moviesWatched)],
    ['Séries assistidas', String(stats.seriesWatched)],
    ['Assistindo agora', String(stats.seriesWatching)],
    ['Episódios vistos', String(stats.episodesWatched)],
    ['Quero ver', String(stats.wantCount)],
    ['Média das suas notas', stats.averageScore === null ? '–' : formatRating(stats.averageScore)],
  ];
  return (
    <section aria-label="Resumo da sua biblioteca" className="mb-10">
      <dl className="grid grid-cols-3 gap-x-4 gap-y-5 border-y border-ink-600 py-5 md:grid-cols-6 md:gap-6">
        {figures.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col-reverse justify-end gap-1">
            <dt className="font-sans text-xs text-balance text-ivory-muted md:whitespace-nowrap">{label}</dt>
            <dd className="font-display text-3xl leading-none text-ivory tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
