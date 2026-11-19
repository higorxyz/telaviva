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
