import type { EpisodeMark, LibraryItem, LibraryState, Rating, TitleRef } from '@/features/library/types';

export type MarkKey = Pick<EpisodeMark, 'tvId' | 'seasonNumber' | 'episodeNumber'>;

/** The rows to write so the stored library goes from `before` to `after`. */
export interface LibraryDiff {
  upsertItems: LibraryItem[];
  deleteItems: TitleRef[];
  upsertRatings: Rating[];
  deleteRatings: TitleRef[];
  upsertMarks: EpisodeMark[];
  deleteMarks: MarkKey[];
}

const titleKey = (r: TitleRef) => `${r.mediaType}:${r.tmdbId}`;
const markKey = (m: MarkKey) => `${m.tvId}:${m.seasonNumber}:${m.episodeNumber}`;

const sameItem = (a: LibraryItem, b: LibraryItem) =>
  a.status === b.status &&
  a.addedAt === b.addedAt &&
  a.updatedAt === b.updatedAt &&
  a.watchedAt === b.watchedAt &&
  a.snapshot.title === b.snapshot.title &&
  a.snapshot.posterPath === b.snapshot.posterPath &&
  a.snapshot.releaseDate === b.snapshot.releaseDate &&
  a.snapshot.genreIds.length === b.snapshot.genreIds.length &&
  a.snapshot.genreIds.every((g, i) => g === b.snapshot.genreIds[i]);

const sameRating = (a: Rating, b: Rating) =>
  a.score === b.score && a.ratedAt === b.ratedAt && a.updatedAt === b.updatedAt;

const sameMark = (a: EpisodeMark, b: EpisodeMark) => a.watchedAt === b.watchedAt;

/** Rows of `after` that are new or changed, and keys of `before` that are gone. Order does not matter. */
function diffRows<T, K>(
  before: T[],
  after: T[],
  keyOf: (row: T) => string,
  same: (a: T, b: T) => boolean,
  toKey: (row: T) => K,
): { upsert: T[]; remove: K[] } {
  const old = new Map(before.map((row) => [keyOf(row), row]));
  const kept = new Set<string>();
  const upsert: T[] = [];
  for (const row of after) {
    const key = keyOf(row);
    kept.add(key);
    const previous = old.get(key);
    if (!previous || !same(previous, row)) upsert.push(row);
  }
  const remove = before.filter((row) => !kept.has(keyOf(row))).map(toKey);
  return { upsert, remove };
}

/** Pure: compares the two states key by key (title, rating per title, mark per episode). */
export function diffStates(before: LibraryState, after: LibraryState): LibraryDiff {
  const ref = (r: TitleRef): TitleRef => ({ mediaType: r.mediaType, tmdbId: r.tmdbId });
  const items = diffRows(before.items, after.items, titleKey, sameItem, ref);
  const ratings = diffRows(before.ratings, after.ratings, titleKey, sameRating, ref);
  const marks = diffRows(before.episodes, after.episodes, markKey, sameMark, (m) => ({
    tvId: m.tvId,
    seasonNumber: m.seasonNumber,
    episodeNumber: m.episodeNumber,
  }));
  return {
    upsertItems: items.upsert,
    deleteItems: items.remove,
    upsertRatings: ratings.upsert,
    deleteRatings: ratings.remove,
    upsertMarks: marks.upsert,
    deleteMarks: marks.remove,
  };
}

export function isEmptyDiff(diff: LibraryDiff): boolean {
  return Object.values(diff).every((rows: unknown[]) => rows.length === 0);
}
