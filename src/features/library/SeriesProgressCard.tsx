'use client';

import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate } from '@/lib/format';
import { buttonClasses } from '@/ui/Button';
import { useLibraryActions, useLibraryEntry } from './hooks';
import { episodeCode, seriesProgress, type TvProgressInfo } from './progress';
import type { TitleSnapshot } from './types';
import { useSeason } from './useSeason';

function Shell({ children }: { children: ReactNode }) {
  return (
    <section
      role="region"
      aria-labelledby="seu-progresso"
      className="mt-6 max-w-3xl rounded-xl border border-amber/40 bg-ink-900 p-4 font-sans"
    >
      <h3 id="seu-progresso" className="font-display text-xl text-ivory">
        Seu progresso
      </h3>
      {children}
    </section>
  );
}

function Bar({ watched, total }: { watched: number; total: number }) {
  return (
    <div className="mt-3">
      <div
        role="progressbar"
        aria-label="Episódios vistos"
        aria-valuemin={0}
        aria-valuenow={watched}
        aria-valuemax={total}
        className="h-1.5 overflow-hidden rounded-full bg-ink-700"
      >
        <div className="h-full rounded-full bg-amber" style={{ width: `${total ? (watched / total) * 100 : 0}%` }} />
      </div>
      <p className="mt-1 text-sm text-ivory-muted tabular-nums">
        {watched} de {total} episódios
      </p>
    </div>
  );
}

/** The visitor's own progress on a series: next episode, bar and a one-tap "Marcar como visto". */
export function SeriesProgressCard({
  tvId,
  info,
  snapshot,
}: {
  tvId: number;
  title: string;
  info: TvProgressInfo;
  snapshot: TitleSnapshot;
}) {
  const { ready, marks } = useLibraryEntry({ mediaType: 'tv', tmdbId: tvId });
  const { run } = useLibraryActions();
  const progress = ready ? seriesProgress(info, marks) : null;
  const next = progress?.kind === 'in-progress' ? progress.next : null;
  const season = useSeason(tvId, next?.seasonNumber ?? null);

  if (!progress || progress.kind === 'not-started') return null;

  if (progress.kind === 'finished') {
    return (
      <Shell>
        <p className="mt-1 text-ivory">Série concluída</p>
      </Shell>
    );
  }

  if (progress.kind === 'caught-up') {
    const date = formatDate(progress.nextAirDate);
    return (
      <Shell>
        <p className="mt-1 text-ivory">Em dia</p>
        {date ? <p className="text-sm text-ivory-muted">Próximo episódio em {date}</p> : null}
      </Shell>
    );
  }

  const name = season.data?.episodes.find((e) => e.episodeNumber === progress.next.episodeNumber)?.name;
  return (
    <Shell>
      <p className="mt-1 text-ivory">
        Próximo: {episodeCode(progress.next)}
        {name ? ` · ${name}` : ''}
      </p>
      <Bar watched={progress.watched} total={progress.total} />
      <button
        type="button"
        className={`${buttonClasses({ variant: 'ghost' })} mt-4`}
        onClick={() =>
          run({
            type: 'setEpisodes',
            tvId,
            marks: [progress.next],
            watched: true,
            snapshot,
            progress: info,
          })
        }
      >
        <Check aria-hidden="true" className="size-4" />
        Marcar como visto
      </button>
    </Shell>
  );
}
