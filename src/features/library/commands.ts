import type { TitleFingerprint } from './fingerprint';
import { airedEpisodes, seriesProgress, type TvProgressInfo } from './progress';
import type {
  EpisodeMark,
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
  /**
   * Internal: puts a title back as it was (used by undo). null and [] remove. `expected` is the title's fingerprint
   * right after the action being undone. The server refuses the restore when the title changed since then (another
   * device wrote it); this reducer ignores it.
   */
  | {
      type: 'restore';
      ref: TitleRef;
      item: LibraryItem | null;
      rating: Rating | null;
      marks: EpisodeMark[];
      expected?: TitleFingerprint;
    }
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

const episodeKey = (r: { seasonNumber: number; episodeNumber: number }) => `${r.seasonNumber}:${r.episodeNumber}`;

function addMarks(
  episodes: EpisodeMark[],
  tvId: number,
  refs: { seasonNumber: number; episodeNumber: number }[],
  now: string,
  refresh: boolean,
): EpisodeMark[] {
  const out = [...episodes];
  // Indexed by episode: a server library can hold tens of thousands of marks.
  const index = new Map<string, number>();
  out.forEach((e, i) => {
    if (e.tvId === tvId && !index.has(episodeKey(e))) index.set(episodeKey(e), i);
  });
  for (const r of refs) {
    const idx = index.get(episodeKey(r));
    if (idx === undefined) {
      index.set(episodeKey(r), out.length);
      out.push({ tvId, seasonNumber: r.seasonNumber, episodeNumber: r.episodeNumber, watchedAt: now });
    } else if (refresh) {
      out[idx] = { ...out[idx]!, watchedAt: now };
    }
  }
  return out;
}

function setEpisodes(
  state: LibraryState,
  command: Extract<LibraryCommand, { type: 'setEpisodes' }>,
  now: string,
): LibraryState {
  const { tvId, marks, watched, snapshot, progress } = command;
  const ref: TitleRef = { mediaType: 'tv', tmdbId: tvId };
  const unmarked = new Set(marks.map(episodeKey));
  const episodes = watched
    ? addMarks(state.episodes, tvId, marks, now, true)
    : state.episodes.filter((e) => !(e.tvId === tvId && unmarked.has(episodeKey(e))));
  const next = { ...state, episodes };
  const existing = findItem(next, ref);
  const hasMarks = episodes.some((e) => e.tvId === tvId);
  const finished = seriesProgress(progress, episodes).kind === 'finished';

  let status: LibraryStatus | null = null;
  if (finished) status = 'watched';
  else if (existing?.status === 'watched') status = 'watching';
  else if (hasMarks && (!existing || existing.status === 'want')) status = 'watching';

  if (!existing) {
    return status ? upsertItem(next, ref, status, snapshot, now) : next;
  }
  // Same status keeps watchedAt; a change sets or clears it.
  return upsertItem(next, ref, status ?? existing.status, snapshot, now);
}

/** Pure reducer: applies one command and never mutates the input state. */
export function applyCommand(state: LibraryState, command: LibraryCommand, now: string): LibraryState {
  switch (command.type) {
    case 'setStatus': {
      let base = state;
      if (command.ref.mediaType === 'tv' && command.status === 'watched' && command.progress) {
        base = {
          ...state,
          episodes: addMarks(state.episodes, command.ref.tmdbId, airedEpisodes(command.progress), now, false),
        };
      }
      return upsertItem(base, command.ref, command.status, command.snapshot, now);
    }
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
      return setEpisodes(state, command, now);
    case 'restore': {
      const { ref, item, rating, marks } = command;
      const items = state.items.filter((i) => !same(i, ref));
      const ratings = state.ratings.filter((r) => !same(r, ref));
      return {
        ...state,
        items: item ? [...items, item] : items,
        ratings: rating ? [...ratings, rating] : ratings,
        episodes:
          ref.mediaType === 'tv' ? [...state.episodes.filter((e) => e.tvId !== ref.tmdbId), ...marks] : state.episodes,
      };
    }
  }
}
