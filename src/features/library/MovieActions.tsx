'use client';

import { Bookmark, BookmarkCheck, Check } from 'lucide-react';
import type { MediaSummary } from '@/features/tmdb/types';
import { cn } from '@/lib/cn';
import { buttonClasses } from '@/ui/Button';
import { UNDOABLE } from './copy';
import { useLibraryActions, useLibraryEntry } from './hooks';
import { RatingControl } from './RatingControl';
import { toSnapshot } from './snapshot';
import type { TitleRef } from './types';

function pillClass(pressed: boolean): string {
  return cn(buttonClasses({ variant: pressed ? 'primary' : 'ghost' }), 'w-full sm:w-auto');
}

/** Quero ver / Já assisti toggles and the personal rating, for a movie page. Neutral until the library loads. */
export function MovieActions({
  movie,
}: {
  movie: Pick<MediaSummary, 'id' | 'title' | 'posterPath' | 'releaseDate' | 'genreIds'>;
}) {
  const ref: TitleRef = { mediaType: 'movie', tmdbId: movie.id };
  const { ready, item } = useLibraryEntry(ref);
  const { run } = useLibraryActions();
  const snapshot = toSnapshot(movie);
  const wanted = ready && item?.status === 'want';
  const seen = ready && item?.status === 'watched';

  return (
    <>
      <button
        type="button"
        aria-pressed={wanted}
        disabled={!ready}
        className={pillClass(wanted)}
        onClick={() =>
          wanted
            ? run({ type: 'remove', ref }, { undoable: UNDOABLE.removed })
            : run({ type: 'setStatus', ref, status: 'want', snapshot }, { undoable: UNDOABLE.saved })
        }
      >
        {wanted ? <BookmarkCheck aria-hidden="true" className="size-4" /> : <Bookmark aria-hidden="true" className="size-4" />}
        Quero ver
      </button>
      <button
        type="button"
        aria-pressed={seen}
        disabled={!ready}
        className={pillClass(seen)}
        onClick={() =>
          seen
            ? run({ type: 'remove', ref }, { undoable: UNDOABLE.removed })
            : run({ type: 'setStatus', ref, status: 'watched', snapshot })
        }
      >
        <Check aria-hidden="true" className="size-4" />
        Já assisti
      </button>
      <RatingControl titleRef={ref} snapshot={snapshot} title={movie.title} />
    </>
  );
}
