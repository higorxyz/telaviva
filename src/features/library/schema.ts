// zod/mini, not zod: this file runs in the browser on every page (the library), and the functional API lets the
// bundler drop what it does not use. Same validation, same core.
import { z } from 'zod/mini';
import { PG_INT_MAX, SNAPSHOT_LIMITS } from './limits';
import { trimSnapshot } from './snapshot';
import type { LibraryState } from './types';

export const isoDate = z.iso.datetime({ offset: true });
export const mediaType = z.enum(['movie', 'tv']);
/** Every number is stored in a Postgres `integer`. */
export const id = z.int().check(z.positive(), z.maximum(PG_INT_MAX));
export const seasonNumber = z.int().check(z.minimum(0), z.maximum(PG_INT_MAX));
export const episodeNumber = z.int().check(z.positive(), z.maximum(PG_INT_MAX));

export const snapshotSchema = z.object({
  title: z.string().check(z.minLength(1), z.maxLength(SNAPSHOT_LIMITS.title)),
  posterPath: z.nullable(z.string().check(z.maxLength(SNAPSHOT_LIMITS.posterPath))),
  releaseDate: z.nullable(z.string().check(z.maxLength(SNAPSHOT_LIMITS.releaseDate))),
  genreIds: z.array(id).check(z.maxLength(SNAPSHOT_LIMITS.genreIds)),
});

export const itemSchema = z
  .object({
    mediaType,
    tmdbId: id,
    status: z.enum(['want', 'watching', 'watched']),
    addedAt: isoDate,
    updatedAt: isoDate,
    watchedAt: z.nullable(isoDate),
    snapshot: snapshotSchema,
  })
  .check(
    z.refine((item) => !(item.mediaType === 'movie' && item.status === 'watching'), {
      message: 'watching is only for series',
      path: ['status'],
    }),
  );

export const episodeSchema = z.object({
  tvId: id,
  seasonNumber,
  episodeNumber,
  watchedAt: isoDate,
});

export const ratingSchema = z.object({
  mediaType,
  tmdbId: id,
  score: z.int().check(z.minimum(1), z.maximum(10)),
  ratedAt: isoDate,
  updatedAt: isoDate,
});

const stateSchema = z.object({
  version: z.literal(1),
  items: z.array(itemSchema),
  episodes: z.array(episodeSchema),
  ratings: z.array(ratingSchema),
});

/** Returns null for anything that is not a valid v1 library state. */
export function parseLibraryState(raw: unknown): LibraryState | null {
  const result = stateSchema.safeParse(raw);
  return result.success ? result.data : null;
}

/** True when the state may be saved as is (the repository refuses to write anything else). */
export function isValidLibraryState(state: unknown): boolean {
  return stateSchema.safeParse(state).success;
}

const rootSchema = z.object({
  version: z.literal(1),
  items: z.array(z.unknown()),
  episodes: z.array(z.unknown()),
  ratings: z.array(z.unknown()),
});

function validRows<T>(rows: unknown[], schema: z.ZodMiniType<T>): T[] {
  return rows.flatMap((row) => {
    const result = schema.safeParse(row);
    return result.success ? [result.data] : [];
  });
}

const looseSnapshot = z.object({
  title: z.string(),
  posterPath: z.nullable(z.string()),
  releaseDate: z.nullable(z.string()),
  genreIds: z.array(z.number()),
});

/**
 * A row saved before SNAPSHOT_LIMITS existed keeps its place: its snapshot is trimmed to fit, not dropped. Any other
 * problem (an empty title, say) is left for the schema to catch.
 */
function fitStoredSnapshot(row: unknown): unknown {
  if (typeof row !== 'object' || row === null) return row;
  const snapshot = looseSnapshot.safeParse((row as { snapshot?: unknown }).snapshot);
  return snapshot.success ? { ...row, snapshot: trimSnapshot(snapshot.data) } : row;
}

/**
 * Parses a stored value row by row: an invalid item, episode mark or rating is dropped on its own and counted in
 * `dropped`, instead of losing the whole library. Null only when the root itself is not a v1 library.
 */
export function parseLibraryEntries(raw: unknown): { state: LibraryState; dropped: number } | null {
  const root = rootSchema.safeParse(raw);
  if (!root.success) return null;
  const { items, episodes, ratings } = root.data;
  const state: LibraryState = {
    version: 1,
    items: validRows(items.map(fitStoredSnapshot), itemSchema),
    episodes: validRows(episodes, episodeSchema),
    ratings: validRows(ratings, ratingSchema),
  };
  const dropped =
    items.length - state.items.length + episodes.length - state.episodes.length + ratings.length - state.ratings.length;
  return { state, dropped };
}

function dedupe<T>(list: T[], keyOf: (entry: T) => string, stampOf: (entry: T) => string): T[] {
  const best = new Map<string, T>();
  for (const entry of list) {
    const key = keyOf(entry);
    const current = best.get(key);
    // ISO strings with a common offset compare lexically, but Date.parse is safe for any offset.
    if (!current || Date.parse(stampOf(entry)) > Date.parse(stampOf(current))) best.set(key, entry);
  }
  return [...best.values()];
}

/** Removes duplicated keys, keeping the newest entry (updatedAt, or watchedAt for episode marks). */
export function normalizeLibraryState(state: LibraryState): LibraryState {
  return {
    version: 1,
    items: dedupe(state.items, (i) => `${i.mediaType}:${i.tmdbId}`, (i) => i.updatedAt),
    episodes: dedupe(state.episodes, (e) => `${e.tvId}:${e.seasonNumber}:${e.episodeNumber}`, (e) => e.watchedAt),
    ratings: dedupe(state.ratings, (r) => `${r.mediaType}:${r.tmdbId}`, (r) => r.updatedAt),
  };
}
