'use client';

import { Check, CircleOff } from 'lucide-react';
import { buttonClasses } from '@/ui/Button';
import { UNDOABLE } from './copy';
import { useLibraryActions, useLibraryEntry } from './hooks';
import type { TvProgressInfo } from './progress';
import type { TitleSnapshot } from './types';

/** Marks or unmarks every aired episode of the open season. Renders nothing when none has aired. */
export function SeasonActions({
  tvId,
  seasonNumber,
  airedEpisodeNumbers,
  info,
  snapshot,
}: {
  tvId: number;
  seasonNumber: number;
  airedEpisodeNumbers: number[];
  info: TvProgressInfo;
  snapshot: TitleSnapshot;
}) {
  const { ready, marks } = useLibraryEntry({ mediaType: 'tv', tmdbId: tvId });
  const { run } = useLibraryActions();
  if (airedEpisodeNumbers.length === 0) return null;

  const done = new Set(marks.filter((m) => m.seasonNumber === seasonNumber).map((m) => m.episodeNumber));
  const allMarked = ready && airedEpisodeNumbers.every((n) => done.has(n));
  const Icon = allMarked ? CircleOff : Check;

  return (
    <div className="mb-4">
      <button
        type="button"
        disabled={!ready}
        className={buttonClasses({ variant: 'ghost' })}
        onClick={() =>
          run(
            {
              type: 'setEpisodes',
              tvId,
              marks: airedEpisodeNumbers.map((episodeNumber) => ({ seasonNumber, episodeNumber })),
              watched: !allMarked,
              snapshot,
              progress: info,
            },
            { undoable: UNDOABLE.season(seasonNumber, !allMarked) },
          )
        }
      >
        <Icon aria-hidden="true" className="size-4" />
        {allMarked ? 'Desmarcar temporada' : 'Marcar temporada'}
      </button>
    </div>
  );
}
