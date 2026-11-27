import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import type { LibraryCommand } from '@/features/library/commands';
import { sameFingerprint, titleFingerprint, type TitleFingerprint } from '@/features/library/fingerprint';
import type { LibraryState, TitleRef } from '@/features/library/types';
import type { Database } from '@/server/db/client';
import { episodeProgress as marks, libraryItems as items, ratings } from '@/server/db/schema';
import type { Statement } from './atomic';
import { clampItem, clampMark, clampRating } from './clamp';
import { LibraryConflictError } from './errors';

/** The rules that make an undo (`restore`) safe on a library shared by several devices. */

type Restore = Extract<LibraryCommand, { type: 'restore' }>;

/**
 * A restore carries timestamps from the client's cache, and restores are written without the newer-wins guard. A
 * timestamp in the future would freeze the row (see clamp.ts), so nothing from a restore is later than `now`.
 */
export function clampRestore(command: Restore, now: string): Restore {
  const { item, rating } = command;
  return {
    ...command,
    item: item && clampItem(item, now),
    rating: rating && clampRating(rating, now),
    marks: command.marks.map((m) => clampMark(m, now)),
  };
}

/** Refuses the restore up front when the loaded title no longer matches what the undo expects. */
export function assertExpected(state: LibraryState, command: Restore): void {
  if (command.expected && !sameFingerprint(titleFingerprint(state, command.ref), command.expected)) {
    throw new LibraryConflictError();
  }
}

/**
 * Marker of the abort below. Postgres reports it as `invalid input syntax for type integer: "library_conflict"`,
 * a message no other statement of ours can produce.
 */
const MARKER = 'library_conflict';

const ms = (column: SQL) => sql`date_trunc('milliseconds', ${column})`;
const sameAt = (actual: SQL, expected: string | null) =>
  expected === null ? sql`(${actual}) is null` : sql`(${actual}) = ${ms(sql`${expected}::timestamptz`)}`;

/**
 * First statement of a restore's batch: checks the fingerprint again inside the transaction and aborts it (an
 * integer cast of the marker fails) when the title changed between the load and the write. This closes the window
 * the up-front check leaves open, and the abort rolls back every write of the batch, never half of a restore.
 */
export function expectedGuard(q: Database, userId: string, ref: TitleRef, expected: TitleFingerprint): Statement {
  const item = sql`(select ${ms(sql`${items.updatedAt}`)} from ${items}
    where ${items.userId} = ${userId} and ${items.mediaType} = ${ref.mediaType} and ${items.tmdbId} = ${ref.tmdbId})`;
  const rating = sql`(select ${ms(sql`${ratings.updatedAt}`)} from ${ratings}
    where ${ratings.userId} = ${userId} and ${ratings.mediaType} = ${ref.mediaType} and ${ratings.tmdbId} = ${ref.tmdbId})`;
  const checks = [sameAt(item, expected.itemUpdatedAt), sameAt(rating, expected.ratingUpdatedAt)];
  if (ref.mediaType === 'tv') {
    const ofSeries = sql`from ${marks} where ${marks.userId} = ${userId} and ${marks.tvId} = ${ref.tmdbId}`;
    checks.push(
      sql`(select count(*)::int ${ofSeries}) = ${expected.markCount}::int`,
      sameAt(sql`select max(${ms(sql`${marks.watchedAt}`)}) ${ofSeries}`, expected.latestMarkAt),
    );
  }
  return q.execute(
    sql`select (case when ${sql.join(checks, sql` and `)} then '1' else ${sql.raw(`'${MARKER}'`)} end)::int as ok`,
  );
}

/** True when `error` (or its cause, as drizzle wraps driver errors) is the abort of `expectedGuard`. */
export function isGuardAbort(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < 5; e = e.cause, depth++) {
    if (e.message.includes(`integer: "${MARKER}"`)) return true;
  }
  return false;
}
