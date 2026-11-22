'use client';

import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { findItem, findRating } from './commands';
import { LIBRARY_KEY, LIBRARY_NETWORK_MODE, useLibraryRepository } from './LibraryProvider';
import { LibrarySessionError, LibraryWrongAccountError } from './repository';
import type { EpisodeMark, LibraryItem, LibraryState, LibraryStatus, Rating, TitleRef } from './types';

const NO_MARKS: EpisodeMark[] = [];

/**
 * A lost session, or one that now belongs to another account, will not come back by asking again: retrying would
 * also call `onUnauthenticated` (or `onWrongAccount`) repeatedly.
 */
const retryLibrary = (failures: number, error: Error) =>
  !(error instanceof LibrarySessionError || error instanceof LibraryWrongAccountError) && failures < 3;

const noopSubscribe = () => () => {};

/**
 * False on the server and while hydrating (React reads the server snapshot then), true afterwards. A boundary that
 * hydrates late (the home rails, behind Suspense) may find the library already loaded by another component; it
 * must still render the server's neutral state first, or React reports a hydration mismatch.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useLibrary(): { state: LibraryState | undefined; ready: boolean } {
  const repository = useLibraryRepository();
  const { data } = useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => repository.load(),
    staleTime: Infinity,
    retry: retryLibrary,
    networkMode: LIBRARY_NETWORK_MODE,
    enabled: !repository.pending,
  });
  const hydrated = useHydrated();
  return hydrated ? { state: data, ready: data !== undefined } : { state: undefined, ready: false };
}

export function useLibraryEntry(ref: TitleRef): {
  ready: boolean;
  item: LibraryItem | null;
  rating: Rating | null;
  marks: EpisodeMark[];
} {
  const { state, ready } = useLibrary();
  if (!state) return { ready, item: null, rating: null, marks: NO_MARKS };
  const marks =
    ref.mediaType === 'tv' ? state.episodes.filter((e) => e.tvId === ref.tmdbId) : NO_MARKS;
  return {
    ready,
    item: findItem(state, ref) ?? null,
    rating: findRating(state, ref) ?? null,
    marks,
  };
}

/**
 * Status of one title. The query selects only that status, so a card re-renders when its own
 * entry changes and not on every library write.
 */
export function useLibraryStatus(ref: TitleRef): { ready: boolean; status: LibraryStatus | null } {
  const repository = useLibraryRepository();
  const { data } = useQuery({
    queryKey: LIBRARY_KEY,
    queryFn: () => repository.load(),
    staleTime: Infinity,
    retry: retryLibrary,
    networkMode: LIBRARY_NETWORK_MODE,
    enabled: !repository.pending,
    select: (state): LibraryStatus | null => findItem(state, ref)?.status ?? null,
  });
  const hydrated = useHydrated();
  return hydrated ? { ready: data !== undefined, status: data ?? null } : { ready: false, status: null };
}

export { useLibraryActions } from './actions';
