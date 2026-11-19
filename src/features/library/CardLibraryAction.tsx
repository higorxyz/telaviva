'use client';

import { BookmarkCheck, Check, Play, Plus } from 'lucide-react';
import type { MediaSummary } from '@/features/tmdb/types';
import { useLibraryActions, useLibraryStatus } from './hooks';
import { useHasLibrary } from './LibraryProvider';
import { toSnapshot } from './snapshot';
import type { TitleRef } from './types';

const SAVED = { message: 'Salvo em Quero ver' };
const REMOVED = { message: 'Removido da sua lista' };

const CIRCLE = 'grid size-8 place-items-center rounded-full bg-ink-950/60 backdrop-blur-sm';

/** Quick "Quero ver" on a poster: icon only. Renders nothing without a library or before it loads. */
export function CardLibraryAction({ item }: { item: MediaSummary }) {
  const hasLibrary = useHasLibrary();
  return hasLibrary ? <Action item={item} /> : null;
}

function Action({ item }: { item: MediaSummary }) {
  const ref: TitleRef = { mediaType: item.mediaType, tmdbId: item.id };
  const { ready, status } = useLibraryStatus(ref);
  const { run } = useLibraryActions();
  if (!ready) return null;

  if (status === 'watching' || status === 'watched') {
    const Icon = status === 'watching' ? Play : Check;
    return (
      <span className={`${CIRCLE} text-ivory`}>
        <Icon aria-hidden="true" className="size-4" />
        <span className="sr-only">Na sua lista: {status === 'watching' ? 'assistindo' : 'assistido'}</span>
      </span>
    );
  }

  const wanted = status === 'want';
  return (
    // 44px hit area around the 32px visual circle.
    <button
      type="button"
      aria-label={`${wanted ? 'Remover' : 'Adicionar'} ${item.title} ${wanted ? 'de' : 'a'} Quero ver`}
      aria-pressed={wanted ? true : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (wanted) run({ type: 'remove', ref }, { undoable: REMOVED });
        else run({ type: 'setStatus', ref, status: 'want', snapshot: toSnapshot(item) }, { undoable: SAVED });
      }}
      className="-m-1.5 grid size-11 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-amber"
    >
      <span
        className={
          wanted
            ? 'grid size-8 place-items-center rounded-full bg-amber text-ink-950'
            : `${CIRCLE} text-ivory`
        }
      >
        {wanted ? <BookmarkCheck aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
      </span>
    </button>
  );
}
