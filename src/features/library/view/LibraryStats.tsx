import { formatRating } from '@/lib/format';
import type { LibraryStats as Stats } from './library-query';

/** An editorial strip of figures: a scrolling row on phones, six columns on desktop. */
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
      <dl className="flex gap-8 overflow-x-auto border-y border-ink-600 py-5 md:grid md:grid-cols-6 md:gap-6 md:overflow-visible">
        {figures.map(([label, value]) => (
          <div key={label} className="flex shrink-0 flex-col-reverse gap-1">
            <dt className="font-sans text-xs whitespace-nowrap text-ivory-muted">{label}</dt>
            <dd className="font-display text-3xl leading-none text-ivory tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
