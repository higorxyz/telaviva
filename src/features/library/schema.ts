import { z } from 'zod';
import type { LibraryState } from './types';

const isoDate = z.iso.datetime({ offset: true });
const mediaType = z.enum(['movie', 'tv']);
const id = z.number().int().positive();

const snapshotSchema = z.object({
  title: z.string().min(1),
  posterPath: z.string().nullable(),
  releaseDate: z.string().nullable(),
  genreIds: z.array(z.number().int()),
});

const itemSchema = z
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

const episodeSchema = z.object({
  tvId: id,
  seasonNumber: z.number().int().min(0),
  episodeNumber: z.number().int().positive(),
  watchedAt: isoDate,
});

const ratingSchema = z.object({
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
