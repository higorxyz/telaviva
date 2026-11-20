import 'server-only';
import { sql } from 'drizzle-orm';
import type { Database } from '@/server/db/client';
import { episodeProgress as marks, libraryItems as items, ratings } from '@/server/db/schema';

/**
 * Reads a user's whole library in ONE statement (three json_agg subqueries), so items, marks and ratings always come
 * from the same snapshot, even when another device writes in between. Marks travel as arrays to keep a large
 * library small on the wire.
 */
export function selectLibrary(q: Database, userId: string) {
  return q.execute(sql`select
    (select coalesce(json_agg(json_build_object(
        'mediaType', ${items.mediaType}, 'tmdbId', ${items.tmdbId}, 'status', ${items.status},
        'addedAt', ${items.addedAt}, 'updatedAt', ${items.updatedAt}, 'watchedAt', ${items.watchedAt},
        'title', ${items.title}, 'posterPath', ${items.posterPath}, 'releaseDate', ${items.releaseDate},
        'genreIds', ${items.genreIds})), '[]'::json)
      from ${items} where ${items.userId} = ${userId}) as items,
    (select coalesce(json_agg(json_build_array(
        ${marks.tvId}, ${marks.seasonNumber}, ${marks.episodeNumber}, ${marks.watchedAt})), '[]'::json)
      from ${marks} where ${marks.userId} = ${userId}) as marks,
    (select coalesce(json_agg(json_build_object(
        'mediaType', ${ratings.mediaType}, 'tmdbId', ${ratings.tmdbId}, 'score', ${ratings.score},
        'ratedAt', ${ratings.ratedAt}, 'updatedAt', ${ratings.updatedAt})), '[]'::json)
      from ${ratings} where ${ratings.userId} = ${userId}) as ratings`);
}

/**
 * Postgres writes timestamps in several shapes (`2026-11-20 01:38:27.922+00`, or `…T01:38:27.922+00:00` in json);
 * the library schema wants ISO 8601. An unparsable value is passed on unchanged, so the schema drops that row.
 */
export function toIso(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

type Json = Record<string, unknown>;

const list = (value: unknown): unknown[] => {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed : [];
};

/** The raw (not yet validated) library from the result of `selectLibrary`, with every timestamp in ISO. */
export function toRawLibrary(result: unknown) {
  const row = ((result as { rows?: Json[] } | undefined)?.rows?.[0] ?? {}) as Json;
  return {
    version: 1 as const,
    items: list(row.items).map((value) => {
      const r = value as Json;
      return {
        mediaType: r.mediaType,
        tmdbId: r.tmdbId,
        status: r.status,
        addedAt: toIso(r.addedAt),
        updatedAt: toIso(r.updatedAt),
        watchedAt: r.watchedAt === null ? null : toIso(r.watchedAt),
        snapshot: { title: r.title, posterPath: r.posterPath, releaseDate: r.releaseDate, genreIds: r.genreIds },
      };
    }),
    episodes: list(row.marks).map((value) => {
      const [tvId, seasonNumber, episodeNumber, watchedAt] = Array.isArray(value) ? (value as unknown[]) : [];
      return { tvId, seasonNumber, episodeNumber, watchedAt: toIso(watchedAt) };
    }),
    ratings: list(row.ratings).map((value) => {
      const r = value as Json;
      return {
        mediaType: r.mediaType,
        tmdbId: r.tmdbId,
        score: r.score,
        ratedAt: toIso(r.ratedAt),
        updatedAt: toIso(r.updatedAt),
      };
    }),
  };
}
