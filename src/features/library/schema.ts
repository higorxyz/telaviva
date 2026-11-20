import { z } from 'zod';
import type { LibraryState } from './types';

export const isoDate = z.iso.datetime({ offset: true });
export const mediaType = z.enum(['movie', 'tv']);
export const id = z.number().int().positive();

export const snapshotSchema = z.object({
  title: z.string().min(1),
  posterPath: z.string().nullable(),
  releaseDate: z.string().nullable(),
  genreIds: z.array(z.number().int()),
});

export const itemSchema = z
  .object({
    mediaType,
    tmdbId: id,
    status: z.enum(['want', 'watching', 'watched']),
    addedAt: isoDate,
    updatedAt: isoDate,
    watchedAt: isoDate.nullable(),
    snapshot: snapshotSchema,
  })
  .refine((item) => !(item.mediaType === 'movie' && item.status === 'watching'), {
    message: 'watching is only for series',
    path: ['status'],
  });

export const episodeSchema = z.object({
  tvId: id,
  seasonNumber: z.number().int().min(0),
  episodeNumber: z.number().int().positive(),
  watchedAt: isoDate,
});

export const ratingSchema = z.object({
  mediaType,
  tmdbId: id,
  score: z.number().int().min(1).max(10),
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

function validRows<T>(rows: unknown[], schema: z.ZodType<T>): T[] {
  return rows.flatMap((row) => {
    const result = schema.safeParse(row);
    return result.success ? [result.data] : [];
  });
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
    items: validRows(items, itemSchema),
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
