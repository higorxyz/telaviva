import 'server-only';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { LibraryCommand } from '@/features/library/commands';
import type { TitleRef } from '@/features/library/types';
import type { Database } from '@/server/db/client';
import { appliedCommands, libraryRemovals as removalsTable } from '@/server/db/schema';
import type { Statement } from './atomic';
import { isEmptyDiff, type LibraryDiff, type MarkKey } from './diff';
import { toIso } from './rows';
import { chunks } from './write';

/**
 * Removal markers: what keeps a late write from bringing back a row removed after it on another device (plan, Foco
 * 4a). Every removal leaves its key and time in `library_removals`; an upsert older than the marker of its key is
 * dropped, and one at least as new clears the marker. A series' marker also covers its episodes (removing a series
 * deletes its marks), so it is kept when the series is written again: it still keeps out the marks done before
 * the removal. A marker older than its live row is harmless (the row's own newer-wins guard decides), and every
 * marker goes after 60 days, past the 30 days an action may wait in the offline queue.
 */

export type RemovalKey = {
  kind: 'item' | 'rating' | 'mark';
  mediaType: TitleRef['mediaType'];
  tmdbId: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
};

/** Time of the removal (ISO) by `removalKey`. */
export type Removals = Map<string, string>;

const titleRemoval = (kind: 'item' | 'rating', ref: TitleRef): RemovalKey => ({
  kind,
  mediaType: ref.mediaType,
  tmdbId: ref.tmdbId,
  seasonNumber: null,
  episodeNumber: null,
});
export const itemRemoval = (ref: TitleRef) => titleRemoval('item', ref);
export const ratingRemoval = (ref: TitleRef) => titleRemoval('rating', ref);
export const markRemoval = (mark: MarkKey): RemovalKey => ({
  kind: 'mark',
  mediaType: 'tv',
  tmdbId: mark.tvId,
  seasonNumber: mark.seasonNumber,
  episodeNumber: mark.episodeNumber,
});
const seriesRemoval = (mark: MarkKey) => itemRemoval({ mediaType: 'tv', tmdbId: mark.tvId });

export const removalKey = (k: RemovalKey) => `${k.kind}:${k.mediaType}:${k.tmdbId}:${k.seasonNumber ?? ''}:${k.episodeNumber ?? ''}`;

const REMOVAL_TTL_MS = 60 * 24 * 60 * 60 * 1000;

/** A removal newer than a write done at `at`. */
function removedAfter(removals: Removals, key: RemovalKey, at: string): boolean {
  const removedAt = removals.get(removalKey(key));
  return removedAt !== undefined && Date.parse(removedAt) > Date.parse(at);
}

/** The diff without the upserts a newer removal covers, each judged by its own timestamp. */
export function dropRemoved(diff: LibraryDiff, removals: Removals): LibraryDiff {
  if (removals.size === 0) return diff;
  return {
    ...diff,
    upsertItems: diff.upsertItems.filter((i) => !removedAfter(removals, itemRemoval(i), i.updatedAt)),
    upsertRatings: diff.upsertRatings.filter((r) => !removedAfter(removals, ratingRemoval(r), r.updatedAt)),
    upsertMarks: diff.upsertMarks.filter(
      (m) => !removedAfter(removals, markRemoval(m), m.watchedAt) && !removedAfter(removals, seriesRemoval(m), m.watchedAt),
    ),
  };
}

/** What the command removes, even when the row is already gone: a newer removal must still move the marker forward. */
function intended(command: LibraryCommand): RemovalKey[] {
  switch (command.type) {
    case 'remove':
      return [itemRemoval(command.ref)];
    case 'unrate':
      return [ratingRemoval(command.ref)];
    case 'setEpisodes':
      return command.watched ? [] : command.marks.map((m) => markRemoval({ tvId: command.tvId, ...m }));
    default:
      return [];
  }
}

export type RemovalPlan = {
  /** The rows to write, without those a newer removal covers. */
  diff: LibraryDiff;
  /** Markers to write or move forward. */
  removed: RemovalKey[];
  /** Markers to clear: those not newer than the row written (`upTo`), or all of them for an undo (`null`). */
  cleared: { key: RemovalKey; upTo: string | null }[];
};

/**
 * What a command writes once removals are taken into account. A restore (undo) is never filtered: it puts back
 * older rows on purpose, its fingerprint guards it (restore.ts), and it clears the markers of what it puts back.
 */
export function planRemovals(command: LibraryCommand, diff: LibraryDiff, removals: Removals): RemovalPlan {
  const restore = command.type === 'restore';
  const kept = restore ? diff : dropRemoved(diff, removals);

  const removed = new Map<string, RemovalKey>();
  const remove = (key: RemovalKey) => removed.set(removalKey(key), key);
  intended(command).forEach(remove);
  kept.deleteItems.forEach((ref) => remove(itemRemoval(ref)));
  kept.deleteRatings.forEach((ref) => remove(ratingRemoval(ref)));
  for (const mark of kept.deleteMarks) {
    if (!removed.has(removalKey(seriesRemoval(mark)))) remove(markRemoval(mark));
  }

  const cleared: RemovalPlan['cleared'] = [];
  const clear = (key: RemovalKey, at: string) => {
    if (removals.has(removalKey(key))) cleared.push({ key, upTo: restore ? null : at });
  };
  kept.upsertItems.forEach((i) => (restore || i.mediaType === 'movie') && clear(itemRemoval(i), i.updatedAt));
  kept.upsertRatings.forEach((r) => clear(ratingRemoval(r), r.updatedAt));
  kept.upsertMarks.forEach((m) => clear(markRemoval(m), m.watchedAt));

  return { diff: kept, removed: [...removed.values()], cleared };
}

export const isEmptyPlan = (plan: RemovalPlan) =>
  isEmptyDiff(plan.diff) && plan.removed.length === 0 && plan.cleared.length === 0;

type Json = Record<string, unknown>;

/**
 * The user's markers, and whether `commandId` was already applied, in one statement (run alongside the library's
 * load, so the whole read costs one round trip).
 */
export async function loadRemovals(
  db: Database,
  userId: string,
  commandId?: string,
): Promise<{ removals: Removals; applied: boolean }> {
  const r = removalsTable;
  const applied =
    commandId === undefined
      ? sql`false`
      : sql`exists (select 1 from ${appliedCommands}
          where ${appliedCommands.userId} = ${userId} and ${appliedCommands.commandId} = ${commandId})`;
  const result = await db.execute(sql`select
    (select coalesce(json_agg(json_build_array(
        ${r.kind}, ${r.mediaType}, ${r.tmdbId}, ${r.seasonNumber}, ${r.episodeNumber}, ${r.removedAt})), '[]'::json)
      from ${r} where ${r.userId} = ${userId}) as removals,
    ${applied} as applied`);
  const row = ((result as { rows?: Json[] }).rows?.[0] ?? {}) as Json;
  const raw: unknown = typeof row.removals === 'string' ? JSON.parse(row.removals) : row.removals;
  const removals: Removals = new Map();
  for (const entry of Array.isArray(raw) ? raw : []) {
    const [kind, mediaType, tmdbId, seasonNumber, episodeNumber, removedAt] = entry as [
      RemovalKey['kind'],
      RemovalKey['mediaType'],
      number,
      number | null,
      number | null,
      string,
    ];
    removals.set(removalKey({ kind, mediaType, tmdbId, seasonNumber, episodeNumber }), String(toIso(removedAt)));
  }
  return { removals, applied: row.applied === true || row.applied === 't' };
}

/** Writes the plan's markers (never moving one back in time) and clears the ones its upserts outdate. */
export function removalStatements(q: Database, userId: string, plan: RemovalPlan, at: string): Statement[] {
  const r = removalsTable;
  const out: Statement[] = [];
  for (const keys of chunks(plan.removed)) {
    out.push(
      q
        .insert(r)
        .values(keys.map((key) => ({ userId, ...key, removedAt: at })))
        .onConflictDoUpdate({
          target: [r.userId, r.kind, r.mediaType, r.tmdbId, r.seasonNumber, r.episodeNumber],
          set: { removedAt: sql`greatest(${r.removedAt}, excluded."removed_at")` },
        }),
    );
  }
  for (const rows of chunks(plan.cleared)) {
    const values = rows.map(
      ({ key: k, upTo }) =>
        sql`(${k.kind}::text, ${k.mediaType}::text, ${k.tmdbId}::int, ${k.seasonNumber}::int, ${k.episodeNumber}::int, ${upTo}::timestamptz)`,
    );
    out.push(
      q.execute(sql`delete from ${r} using (values ${sql.join(values, sql`, `)})
          as v(kind, media_type, tmdb_id, season_number, episode_number, up_to)
        where ${r.userId} = ${userId} and ${r.kind} = v.kind and ${r.mediaType} = v.media_type
          and ${r.tmdbId} = v.tmdb_id and ${r.seasonNumber} is not distinct from v.season_number
          and ${r.episodeNumber} is not distinct from v.episode_number
          and (v.up_to is null or ${r.removedAt} <= v.up_to)`),
    );
  }
  return out;
}

/** Opportunistic cleanup, in every write of the user (no paid job): the markers past 60 days. */
export function forgetOldRemovals(q: Database, userId: string, now: string): Statement {
  const cutoff = new Date(Date.parse(now) - REMOVAL_TTL_MS).toISOString();
  return q.delete(removalsTable).where(and(eq(removalsTable.userId, userId), lt(removalsTable.removedAt, cutoff)));
}
