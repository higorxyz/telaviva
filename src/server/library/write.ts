import 'server-only';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import type { Database } from '@/server/db/client';
import { episodeProgress, libraryItems, ratings } from '@/server/db/schema';
import type { Statement } from './atomic';
import type { LibraryDiff } from './diff';

/** Rows per statement: far below Postgres' 65,535 bind parameters (items have 11 columns). */
const CHUNK = 1_000;

export function chunks<T>(rows: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += CHUNK) out.push(rows.slice(i, i + CHUNK));
  return out;
}

/** `(a, b) in ((1, 2), (3, 4))` over the given columns. */
function keyIn(columns: SQL[], keys: (string | number)[][]): SQL {
  const tuples = keys.map((key) => sql`(${sql.join(key.map((v) => sql`${v}`), sql`, `)})`);
  return sql`(${sql.join(columns, sql`, `)}) in (${sql.join(tuples, sql`, `)})`;
}

const excluded = (column: string) => sql.raw(`excluded."${column}"`);

/**
 * Statements that apply `diff` to the user's rows: deletes, then upserts.
 *
 * With `at` (the time of the command; every command but restore), both are guarded newer-wins, by `updated_at`, or
 * `watched_at` for marks:
 * - an upsert only replaces a row that is not newer than the incoming one: a request that reached the server
 *   earlier but writes later can never overwrite a newer change from another device;
 * - a delete only removes a row not changed after `at`: a removal done offline and arriving late never deletes
 *   what another device changed after it.
 *
 * Restore (`at` null) puts older rows back on purpose; it is checked against the title's expected fingerprint
 * instead (see restore.ts), and its timestamps are never later than `now`.
 */
export function diffStatements(q: Database, userId: string, diff: LibraryDiff, at: string | null): Statement[] {
  const out: Statement[] = [];
  const guard = (sqlText: SQL) => (at === null ? {} : { setWhere: sqlText });
  // Timestamps are read at millisecond precision (rows.ts); a row stamped by Postgres may carry microseconds.
  const notAfter = (column: SQL) => (at === null ? [] : [sql`date_trunc('milliseconds', ${column}) <= ${at}::timestamptz`]);

  for (const keys of chunks(diff.deleteItems)) {
    const where = keyIn([sql`${libraryItems.mediaType}`, sql`${libraryItems.tmdbId}`], keys.map((k) => [k.mediaType, k.tmdbId]));
    const fresh = notAfter(sql`${libraryItems.updatedAt}`);
    out.push(q.delete(libraryItems).where(and(eq(libraryItems.userId, userId), where, ...fresh)));
  }
  for (const keys of chunks(diff.deleteRatings)) {
    const where = keyIn([sql`${ratings.mediaType}`, sql`${ratings.tmdbId}`], keys.map((k) => [k.mediaType, k.tmdbId]));
    const fresh = notAfter(sql`${ratings.updatedAt}`);
    out.push(q.delete(ratings).where(and(eq(ratings.userId, userId), where, ...fresh)));
  }
  for (const keys of chunks(diff.deleteMarks)) {
    const columns = [sql`${episodeProgress.tvId}`, sql`${episodeProgress.seasonNumber}`, sql`${episodeProgress.episodeNumber}`];
    const where = keyIn(columns, keys.map((k) => [k.tvId, k.seasonNumber, k.episodeNumber]));
    const fresh = notAfter(sql`${episodeProgress.watchedAt}`);
    out.push(q.delete(episodeProgress).where(and(eq(episodeProgress.userId, userId), where, ...fresh)));
  }

  for (const rows of chunks(diff.upsertItems)) {
    const values = rows.map((i) => ({
      userId,
      mediaType: i.mediaType,
      tmdbId: i.tmdbId,
      status: i.status,
      addedAt: i.addedAt,
      updatedAt: i.updatedAt,
      watchedAt: i.watchedAt,
      title: i.snapshot.title,
      posterPath: i.snapshot.posterPath,
      releaseDate: i.snapshot.releaseDate,
      genreIds: i.snapshot.genreIds,
    }));
    out.push(
      q
        .insert(libraryItems)
        .values(values)
        .onConflictDoUpdate({
          target: [libraryItems.userId, libraryItems.mediaType, libraryItems.tmdbId],
          set: {
            status: excluded('status'),
            addedAt: excluded('added_at'),
            updatedAt: excluded('updated_at'),
            watchedAt: excluded('watched_at'),
            title: excluded('title'),
            posterPath: excluded('poster_path'),
            releaseDate: excluded('release_date'),
            genreIds: excluded('genre_ids'),
          },
          ...guard(sql`${libraryItems.updatedAt} <= excluded."updated_at"`),
        }),
    );
  }
  for (const rows of chunks(diff.upsertRatings)) {
    const values = rows.map((r) => ({ ...r, userId }));
    out.push(
      q
        .insert(ratings)
        .values(values)
        .onConflictDoUpdate({
          target: [ratings.userId, ratings.mediaType, ratings.tmdbId],
          set: { score: excluded('score'), ratedAt: excluded('rated_at'), updatedAt: excluded('updated_at') },
          ...guard(sql`${ratings.updatedAt} <= excluded."updated_at"`),
        }),
    );
  }
  for (const rows of chunks(diff.upsertMarks)) {
    const values = rows.map((m) => ({ ...m, userId }));
    out.push(
      q
        .insert(episodeProgress)
        .values(values)
        .onConflictDoUpdate({
          target: [episodeProgress.userId, episodeProgress.tvId, episodeProgress.seasonNumber, episodeProgress.episodeNumber],
          set: { watchedAt: excluded('watched_at') },
          ...guard(sql`${episodeProgress.watchedAt} <= excluded."watched_at"`),
        }),
    );
  }
  return out;
}
