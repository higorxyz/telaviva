import type { TvProgressInfo } from './progress';
import type {
  LibraryItem,
  LibraryState,
  LibraryStatus,
  Rating,
  TitleRef,
  TitleSnapshot,
} from './types';

export type LibraryCommand =
  | { type: 'setStatus'; ref: TitleRef; status: LibraryStatus; snapshot: TitleSnapshot; progress?: TvProgressInfo }
  | { type: 'remove'; ref: TitleRef }
  | { type: 'rate'; ref: TitleRef; score: number; snapshot: TitleSnapshot }
  | { type: 'unrate'; ref: TitleRef }
  | {
      type: 'setEpisodes';
      tvId: number;
      marks: { seasonNumber: number; episodeNumber: number }[];
      watched: boolean;
      snapshot: TitleSnapshot;
      progress: TvProgressInfo;
    };

export const itemKey = (ref: TitleRef): string => `${ref.mediaType}:${ref.tmdbId}`;

const same = (a: TitleRef, b: TitleRef) => a.mediaType === b.mediaType && a.tmdbId === b.tmdbId;

export function findItem(state: LibraryState, ref: TitleRef): LibraryItem | undefined {
  return state.items.find((i) => same(i, ref));
}

export function findRating(state: LibraryState, ref: TitleRef): Rating | undefined {
  return state.ratings.find((r) => same(r, ref));
}

function upsertItem(
  state: LibraryState,
  ref: TitleRef,
  status: LibraryStatus,
  snapshot: TitleSnapshot,
  now: string,
): LibraryState {
  if (status === 'watching' && ref.mediaType === 'movie') {
    throw new Error('watching is only for series');
  }
  const existing = findItem(state, ref);
  let item: LibraryItem;
  if (!existing) {
    item = {
      mediaType: ref.mediaType,
      tmdbId: ref.tmdbId,
      status,
      addedAt: now,
      updatedAt: now,
      watchedAt: status === 'watched' ? now : null,
      snapshot,
    };
  } else if (existing.status === status) {
    item = { ...existing, updatedAt: now, snapshot };
  } else {
    item = {
      ...existing,
      status,
      updatedAt: now,
      watchedAt: status === 'watched' ? now : null,
      snapshot,
    };
  }
  const items = existing ? state.items.map((i) => (i === existing ? item : i)) : [...state.items, item];
  return { ...state, items };
}

function rate(state: LibraryState, ref: TitleRef, score: number, snapshot: TitleSnapshot, now: string): LibraryState {
  if (!Number.isInteger(score) || score < 1 || score > 10) {
    throw new Error('score must be an integer from 1 to 10');
  }
  const existing = findRating(state, ref);
  const rating: Rating = {
    mediaType: ref.mediaType,
    tmdbId: ref.tmdbId,
    score,
    ratedAt: existing?.ratedAt ?? now,
    updatedAt: now,
  };
  const ratings = existing ? state.ratings.map((r) => (r === existing ? rating : r)) : [...state.ratings, rating];
  const rated = { ...state, ratings };
  // Whoever rates a movie has watched it; rating a series says nothing about status.
  if (ref.mediaType === 'movie' && findItem(rated, ref)?.status !== 'watched') {
    return upsertItem(rated, ref, 'watched', snapshot, now);
  }
  return rated;
}

/** Pure reducer: applies one command and never mutates the input state. */
export function applyCommand(state: LibraryState, command: LibraryCommand, now: string): LibraryState {
  switch (command.type) {
    case 'setStatus':
      return upsertItem(state, command.ref, command.status, command.snapshot, now);
    case 'remove':
      return {
        ...state,
        items: state.items.filter((i) => !same(i, command.ref)),
        episodes:
          command.ref.mediaType === 'tv'
            ? state.episodes.filter((e) => e.tvId !== command.ref.tmdbId)
            : state.episodes,
      };
    case 'rate':
      return rate(state, command.ref, command.score, command.snapshot, now);
    case 'unrate':
      return { ...state, ratings: state.ratings.filter((r) => !same(r, command.ref)) };
    case 'setEpisodes':
      throw new Error('not implemented');
  }
}
