// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LibraryCommand } from '@/features/library/commands';
import type { EpisodeMark, LibraryItem, Rating, TitleRef } from '@/features/library/types';
import { appliedCommands, libraryRemovals, users } from '@/server/db/schema';
import { createTestDb } from '@/test/db';
import type { LibraryDiff } from './diff';
import {
  dropRemoved,
  itemRemoval,
  loadRemovals,
  markRemoval,
  planRemovals,
  ratingRemoval,
  removalKey,
  type RemovalKey,
  type Removals,
} from './removals';

const T0 = '2026-11-20T10:00:00.000Z';
const T1 = '2026-11-20T11:00:00.000Z';
const T2 = '2026-11-20T12:00:00.000Z';
const snapshot = { title: 'Família Soprano', posterPath: null, releaseDate: null, genreIds: [] };
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const tv: TitleRef = { mediaType: 'tv', tmdbId: 1398 };
const item = (ref: TitleRef, updatedAt: string): LibraryItem => ({
  ...ref,
  status: 'want',
  addedAt: T0,
  updatedAt,
  watchedAt: null,
  snapshot,
});
const rating = (ref: TitleRef, updatedAt: string): Rating => ({ ...ref, score: 7, ratedAt: T0, updatedAt });
const mark = (episodeNumber: number, watchedAt: string): EpisodeMark => ({
  tvId: tv.tmdbId,
  seasonNumber: 1,
  episodeNumber,
  watchedAt,
});
const markKey = (episodeNumber: number) => ({ tvId: tv.tmdbId, seasonNumber: 1, episodeNumber });
const diff = (over: Partial<LibraryDiff>): LibraryDiff => ({
  upsertItems: [],
  deleteItems: [],
  upsertRatings: [],
  deleteRatings: [],
  upsertMarks: [],
  deleteMarks: [],
  ...over,
});
const removals = (...entries: [RemovalKey, string][]): Removals => new Map(entries.map(([k, at]) => [removalKey(k), at]));
const keys = (list: RemovalKey[]) => list.map(removalKey).sort();
const progress = { tvId: tv.tmdbId, ended: false, seasons: [], lastAired: null, nextToAir: null };

describe('removal keys', () => {
  it('names each kind apart, with season and episode only for marks', () => {
    expect(itemRemoval(movie)).toEqual({ kind: 'item', mediaType: 'movie', tmdbId: 550, seasonNumber: null, episodeNumber: null });
    expect(ratingRemoval(tv)).toEqual({ kind: 'rating', mediaType: 'tv', tmdbId: 1398, seasonNumber: null, episodeNumber: null });
    expect(markRemoval(markKey(3))).toEqual({ kind: 'mark', mediaType: 'tv', tmdbId: 1398, seasonNumber: 1, episodeNumber: 3 });
    const all = [itemRemoval(tv), ratingRemoval(tv), markRemoval(markKey(1)), markRemoval(markKey(2)), itemRemoval(movie)];
    expect(new Set(all.map(removalKey)).size).toBe(all.length);
  });
});

describe('dropRemoved', () => {
  it('drops an upsert older than its removal and keeps one as new or newer', () => {
    const out = dropRemoved(
      diff({
        upsertItems: [item(movie, T0), item(tv, T1)],
        upsertRatings: [rating(movie, T0), rating(tv, T2)],
        upsertMarks: [mark(1, T0), mark(2, T1)],
      }),
      removals(
        [itemRemoval(movie), T1],
        [itemRemoval(tv), T1],
        [ratingRemoval(movie), T1],
        [ratingRemoval(tv), T1],
        [markRemoval(markKey(1)), T1],
        [markRemoval(markKey(2)), T1],
      ),
    );
    expect(out.upsertItems).toEqual([item(tv, T1)]);
    expect(out.upsertRatings).toEqual([rating(tv, T2)]);
    expect(out.upsertMarks).toEqual([mark(2, T1)]);
  });

  it("drops a mark older than its series' removal, even without a marker of its own", () => {
    const out = dropRemoved(diff({ upsertMarks: [mark(1, T0), mark(2, T2)] }), removals([itemRemoval(tv), T1]));
    expect(out.upsertMarks).toEqual([mark(2, T2)]);
  });

  it('a removal of one kind never drops another kind', () => {
    const out = dropRemoved(diff({ upsertRatings: [rating(movie, T0)] }), removals([itemRemoval(movie), T1]));
    expect(out.upsertRatings).toEqual([rating(movie, T0)]);
  });

  it('leaves the deletes alone', () => {
    const d = diff({ deleteItems: [movie], deleteMarks: [markKey(1)] });
    expect(dropRemoved(d, removals([itemRemoval(movie), T1]))).toEqual(d);
  });
});

describe('planRemovals', () => {
  const none: Removals = new Map();

  it('marks every row the command deletes', () => {
    const plan = planRemovals(
      { type: 'unrate', ref: movie },
      diff({ deleteItems: [movie], deleteRatings: [movie], deleteMarks: [markKey(4)] }),
      none,
    );
    expect(keys(plan.removed)).toEqual(keys([itemRemoval(movie), ratingRemoval(movie), markRemoval(markKey(4))]));
  });

  it('marks what the command removes even when the row is already gone (a newer removal must still win)', () => {
    expect(keys(planRemovals({ type: 'remove', ref: movie }, diff({}), none).removed)).toEqual(keys([itemRemoval(movie)]));
    expect(keys(planRemovals({ type: 'unrate', ref: tv }, diff({}), none).removed)).toEqual(keys([ratingRemoval(tv)]));
    const unmark: LibraryCommand = {
      type: 'setEpisodes',
      tvId: tv.tmdbId,
      marks: [
        { seasonNumber: 1, episodeNumber: 1 },
        { seasonNumber: 1, episodeNumber: 2 },
      ],
      watched: false,
      snapshot,
      progress,
    };
    expect(keys(planRemovals(unmark, diff({}), none).removed)).toEqual(keys([markRemoval(markKey(1)), markRemoval(markKey(2))]));
  });

  it("one marker for a removed series covers its episodes (no marker per mark)", () => {
    const plan = planRemovals(
      { type: 'remove', ref: tv },
      diff({ deleteItems: [tv], deleteMarks: [markKey(1), markKey(2), { tvId: 99, seasonNumber: 1, episodeNumber: 1 }] }),
      none,
    );
    expect(keys(plan.removed)).toEqual(keys([itemRemoval(tv), markRemoval({ tvId: 99, seasonNumber: 1, episodeNumber: 1 })]));
  });

  it('drops the upserts a newer removal covers, and clears the markers of the rows it writes', () => {
    const plan = planRemovals(
      { type: 'rate', ref: movie, score: 7, snapshot },
      diff({ upsertItems: [item(movie, T2)], upsertRatings: [rating(movie, T2)], upsertMarks: [mark(1, T0)] }),
      removals([itemRemoval(movie), T1], [markRemoval(markKey(1)), T1]),
    );
    expect(plan.diff.upsertItems).toEqual([item(movie, T2)]);
    expect(plan.diff.upsertMarks).toEqual([]);
    // Only markers that exist are cleared: the rating has none.
    expect(plan.cleared).toEqual([{ key: itemRemoval(movie), upTo: T2 }]);
  });

  it("keeps a series' marker when the series is written again: it still keeps out marks older than the removal", () => {
    const plan = planRemovals(
      { type: 'setStatus', ref: tv, status: 'want', snapshot },
      diff({ upsertItems: [item(tv, T2)], upsertMarks: [mark(1, T2)] }),
      removals([itemRemoval(tv), T1], [markRemoval(markKey(1)), T1]),
    );
    expect(plan.diff.upsertItems).toEqual([item(tv, T2)]);
    expect(plan.cleared).toEqual([{ key: markRemoval(markKey(1)), upTo: T2 }]);
  });

  it('a restore is never filtered (its fingerprint guards it) and clears every marker of what it puts back', () => {
    const restore: LibraryCommand = { type: 'restore', ref: tv, item: item(tv, T0), rating: null, marks: [mark(1, T0)] };
    const d = diff({ upsertItems: [item(tv, T0)], upsertMarks: [mark(1, T0)], deleteRatings: [tv] });
    const plan = planRemovals(restore, d, removals([itemRemoval(tv), T1], [markRemoval(markKey(1)), T1]));
    expect(plan.diff).toEqual(d);
    expect(plan.cleared).toEqual(
      expect.arrayContaining([
        { key: itemRemoval(tv), upTo: null },
        { key: markRemoval(markKey(1)), upTo: null },
      ]),
    );
    expect(keys(plan.removed)).toEqual(keys([ratingRemoval(tv)]));
  });
});

describe('the tables (PGlite)', () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  beforeAll(async () => {
    db = await createTestDb();
    await db.insert(users).values([{ id: 'u1' }, { id: 'u2' }]);
  });
  afterAll(async () => {
    await db.$client.close();
  });

  it('one marker per key, even with the empty season and episode of items and ratings (NULLS NOT DISTINCT)', async () => {
    const row = { userId: 'u1', kind: 'item', mediaType: 'movie', tmdbId: 1, removedAt: T0 };
    await db.insert(libraryRemovals).values(row);
    await expect(db.insert(libraryRemovals).values(row)).rejects.toThrow();
    await db.insert(libraryRemovals).values({ ...row, kind: 'rating' });
    await db.insert(libraryRemovals).values({ ...row, userId: 'u2' });
  });

  it('refuses an unknown kind and an unknown user', async () => {
    await expect(db.insert(libraryRemovals).values({ userId: 'u1', kind: 'x', mediaType: 'movie', tmdbId: 2, removedAt: T0 })).rejects.toThrow();
    await expect(
      db.insert(libraryRemovals).values({ userId: 'ghost', kind: 'item', mediaType: 'movie', tmdbId: 2, removedAt: T0 }),
    ).rejects.toThrow();
    await expect(db.insert(appliedCommands).values({ userId: 'ghost', commandId: 'c', appliedAt: T0 })).rejects.toThrow();
  });

  it('one applied command per user and id', async () => {
    await db.insert(appliedCommands).values({ userId: 'u1', commandId: 'c1', appliedAt: T0 });
    await expect(db.insert(appliedCommands).values({ userId: 'u1', commandId: 'c1', appliedAt: T1 })).rejects.toThrow();
    await db.insert(appliedCommands).values({ userId: 'u2', commandId: 'c1', appliedAt: T0 });
  });

  it("loadRemovals reads the user's markers and whether the command id was applied, in one statement", async () => {
    await db.insert(libraryRemovals).values({
      userId: 'u1',
      kind: 'mark',
      mediaType: 'tv',
      tmdbId: 1398,
      seasonNumber: 1,
      episodeNumber: 2,
      removedAt: T1,
    });
    const loaded = await loadRemovals(db, 'u1', 'c1');
    expect(loaded.applied).toBe(true);
    expect(loaded.removals.get(removalKey(markRemoval(markKey(2))))).toBe(T1);
    expect(loaded.removals.get(removalKey(itemRemoval({ mediaType: 'movie', tmdbId: 1 })))).toBe(T0);
    expect(loaded.removals.size).toBe(3);
    expect((await loadRemovals(db, 'u1', 'c2')).applied).toBe(false);
    expect((await loadRemovals(db, 'u1')).applied).toBe(false);
    expect((await loadRemovals(db, 'nobody')).removals.size).toBe(0);
  });
});
