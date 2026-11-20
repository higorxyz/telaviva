'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { UNDOABLE } from './copy';
import { useLibraryActions, useLibraryEntry } from './hooks';
import { episodeCode, marksThrough, type EpisodeRef, type TvProgressInfo } from './progress';
import type { TitleSnapshot } from './types';

const PILL =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber disabled:opacity-60 motion-reduce:transition-none';

/**
 * "Marcar como visto" / "Visto" for one episode, plus "Até aqui" to mark everything aired up to it.
 * Neutral and disabled until the library loads, so the first client render matches the server.
 */
export function EpisodeToggle({
  tvId,
  episode,
  aired,
  info,
  snapshot,
}: {
  tvId: number;
  episode: EpisodeRef;
  aired: boolean;
  info: TvProgressInfo;
  snapshot: TitleSnapshot;
}) {
  const { ready, marks } = useLibraryEntry({ mediaType: 'tv', tmdbId: tvId });
  const { run } = useLibraryActions();
  const seen =
    ready &&
    marks.some((m) => m.seasonNumber === episode.seasonNumber && m.episodeNumber === episode.episodeNumber);
  const mark = { seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber };

  if (!aired) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={cn(PILL, 'border border-ink-600 text-ivory-muted')}
      >
        Ainda não exibido
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={seen}
        disabled={!ready}
        onClick={() =>
          run({ type: 'setEpisodes', tvId, marks: [mark], watched: !seen, snapshot, progress: info })
        }
        className={cn(
          PILL,
          seen
            ? 'bg-amber text-ink-950 hover:bg-amber-strong'
            : 'border border-ivory/35 text-ivory hover:border-ivory/70 hover:bg-ivory/5',
        )}
      >
        <Check aria-hidden="true" className="size-4" />
        {seen ? 'Visto' : 'Marcar como visto'}
      </button>
      {episode.seasonNumber > 0 ? (
        <button
          type="button"
          disabled={!ready}
          // The accessible name starts with the visible text (WCAG 2.5.3).
          aria-label={`Até aqui: marcar até ${episodeCode(episode)}`}
          onClick={() =>
            run(
              {
                type: 'setEpisodes',
                tvId,
                marks: marksThrough(info, episode),
                watched: true,
                snapshot,
                progress: info,
              },
              { undoable: UNDOABLE.markedUpTo(episode) },
            )
          }
          className={cn(PILL, 'px-3 text-ivory-muted hover:text-ivory')}
        >
          Até aqui
        </button>
      ) : null}
    </div>
  );
}
