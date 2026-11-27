// @vitest-environment node
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LibraryCommand } from '@/features/library/commands';
import { titleFingerprint } from '@/features/library/fingerprint';
import type { LibraryState, TitleRef } from '@/features/library/types';
import { appliedCommands, episodeProgress, libraryItems, libraryRemovals, ratings, users } from '@/server/db/schema';
import { createTestDb } from '@/test/db';
import { LibraryConflictError, LibraryStaleError } from './errors';
import { applyLibraryCommand, loadLibrary } from './store';

/**
 * Two devices sharing one account (plan, Foco 4): A works offline and its queue reaches the server late, carrying the
 * time of each action (`at`); B stays online. The newer change wins in both directions, row by row.
 */

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.$client.close();
});

let userId: string;
let seq = 0;
beforeEach(async () => {
  userId = `offline-user-${++seq}`;
  await db.insert(users).values({ id: userId });
});

const T0 = '2026-11-20T09:00:00.000Z';
const T10 = '2026-11-20T10:00:00.000Z';
const T1030 = '2026-11-20T10:30:00.000Z';
const T11 = '2026-11-20T11:00:00.000Z';
const T1130 = '2026-11-20T11:30:00.000Z';
const T12 = '2026-11-20T12:00:00.000Z';
const T13 = '2026-11-20T13:00:00.000Z';
const DAY = 24 * 60 * 60 * 1000;
const daysBefore = (iso: string, days: number) => new Date(Date.parse(iso) - days * DAY).toISOString();

const snapshot = { title: 'Família Soprano', posterPath: '/s.jpg', releaseDate: '1999-01-10', genreIds: [18, 80] };
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const tv: TitleRef = { mediaType: 'tv', tmdbId: 1398 };
const progress = {
  tvId: tv.tmdbId,
  ended: true,
  seasons: [{ seasonNumber: 1, episodeCount: 10 }],
  lastAired: { seasonNumber: 1, episodeNumber: 10 },
  nextToAir: null,
};
const setStatus = (ref: TitleRef, status: 'want' | 'watching' | 'watched'): LibraryCommand => ({
  type: 'setStatus',
  ref,
  status,
  snapshot,
});
const remove = (ref: TitleRef): LibraryCommand => ({ type: 'remove', ref });
const rate = (ref: TitleRef, score: number): LibraryCommand => ({ type: 'rate', ref, score, snapshot });
const unrate = (ref: TitleRef): LibraryCommand => ({ type: 'unrate', ref });
const episodes = (watched: boolean, ...eps: number[]): LibraryCommand => ({
  type: 'setEpisodes',
  tvId: tv.tmdbId,
  marks: eps.map((episodeNumber) => ({ seasonNumber: 1, episodeNumber })),
  watched,
  snapshot,
  progress,
});

/** Device B, online: the server stamps the command with its own clock. */
const online = async (command: LibraryCommand, now: string) => (await applyLibraryCommand(db, userId, command, now)).state;
/** Device A's queue: the command done at `at`, reaching the server at `now`. */
const queued = async (command: LibraryCommand, at: string, now: string, commandId?: string) =>
  (await applyLibraryCommand(db, userId, command, now, { at, ...(commandId ? { commandId } : {}) })).state;

const itemOf = (state: LibraryState, ref: TitleRef) =>
  state.items.find((i) => i.mediaType === ref.mediaType && i.tmdbId === ref.tmdbId);
const ratingOf = (state: LibraryState, ref: TitleRef) =>
  state.ratings.find((r) => r.mediaType === ref.mediaType && r.tmdbId === ref.tmdbId);
const episodeNumbers = (state: LibraryState) =>
  state.episodes
    .filter((e) => e.tvId === tv.tmdbId)
    .map((e) => e.episodeNumber)
    .sort((a, b) => a - b);

async function markers() {
  return db
    .select({
      kind: libraryRemovals.kind,
      mediaType: libraryRemovals.mediaType,
      tmdbId: libraryRemovals.tmdbId,
      seasonNumber: libraryRemovals.seasonNumber,
      episodeNumber: libraryRemovals.episodeNumber,
      removedAt: libraryRemovals.removedAt,
    })
    .from(libraryRemovals)
    .where(eq(libraryRemovals.userId, userId));
}

async function appliedCount() {
  const [row] = await db.select({ n: count() }).from(appliedCommands).where(eq(appliedCommands.userId, userId));
  return row!.n;
}

describe('a late removal never deletes what changed after it (Foco 4b)', () => {
  it('item: A removes offline at 10h, B changes it at 11h, the removal arrives at 12h → B’s item stays', async () => {
    await online(setStatus(movie, 'want'), T0);
    await online(setStatus(movie, 'watched'), T11);
    const state = await queued(remove(movie), T10, T12);
    expect(itemOf(state, movie)).toMatchObject({ status: 'watched', updatedAt: T11 });
    expect(itemOf(await loadLibrary(db, userId), movie)).toMatchObject({ status: 'watched', updatedAt: T11 });
  });

  it('rating: an unrate done before the newer rating keeps the rating', async () => {
    await online(rate(tv, 6), T0);
    await online(rate(tv, 9), T11);
    const state = await queued(unrate(tv), T10, T12);
    expect(ratingOf(state, tv)).toMatchObject({ score: 9, updatedAt: T11 });
  });

  it('mark: unmarking an episode before it was marked again keeps the mark', async () => {
    await online(episodes(true, 1), T0);
    await online(episodes(true, 1), T11);
    const state = await queued(episodes(false, 1), T10, T12);
    expect(state.episodes).toMatchObject([{ episodeNumber: 1, watchedAt: T11 }]);
  });

  it('series: a late removal keeps the item and the marks changed after it, and drops only the older marks', async () => {
    await online(episodes(true, 1), T0);
    await online(episodes(true, 2), T11);
    const state = await queued(remove(tv), T10, T12);
    expect(itemOf(state, tv)).toMatchObject({ updatedAt: T11 });
    expect(episodeNumbers(state)).toEqual([2]);
  });
});

describe('a late write never brings back what was removed after it (Foco 4a)', () => {
  it('item: A marks watched offline at 10h, B removes at 11h, A’s queue arrives at 12h → the movie stays out', async () => {
    await online(setStatus(movie, 'want'), T0);
    await online(remove(movie), T11);
    const state = await queued(setStatus(movie, 'watched'), T10, T12);
    expect(itemOf(state, movie)).toBeUndefined();
    expect(itemOf(await loadLibrary(db, userId), movie)).toBeUndefined();
  });

  it('rating: a rating done before the unrate stays out', async () => {
    await online(rate(tv, 6), T0);
    await online(unrate(tv), T11);
    expect(ratingOf(await queued(rate(tv, 9), T10, T12), tv)).toBeUndefined();
  });

  it('mark: an episode marked before it was unmarked stays unmarked', async () => {
    await online(episodes(true, 1, 2), T0);
    await online(episodes(false, 1), T11);
    const state = await queued(episodes(true, 1), T10, T12);
    expect(episodeNumbers(state)).toEqual([2]);
  });

  it('setEpisodes after B removed the series: neither the series nor its marks come back', async () => {
    await online(episodes(true, 1), T0);
    await online(remove(tv), T11);
    const state = await queued(episodes(true, 2, 3), T10, T12);
    expect(itemOf(state, tv)).toBeUndefined();
    expect(state.episodes).toEqual([]);
  });

  it('setStatus watched (which marks every aired episode) after the removal brings back nothing', async () => {
    await online(setStatus(tv, 'watching'), T0);
    await online(remove(tv), T11);
    const state = await queued({ ...setStatus(tv, 'watched'), progress } as LibraryCommand, T10, T12);
    expect(itemOf(state, tv)).toBeUndefined();
    expect(state.episodes).toEqual([]);
  });

  it('a series added again after the removal still keeps out the marks done before the removal', async () => {
    await online(episodes(true, 1), T0);
    await online(remove(tv), T11);
    await online(setStatus(tv, 'want'), T12);
    const state = await queued(episodes(true, 2), T10, T13);
    expect(episodeNumbers(state)).toEqual([]);
    // A mark done between the removal and now is newer than the removal: it counts.
    expect(episodeNumbers(await queued(episodes(true, 3), T1130, T13))).toEqual([3]);
  });

  it('a removal of something already removed still moves its marker forward (the newer removal wins)', async () => {
    await online(setStatus(movie, 'want'), T0);
    await online(remove(movie), T11);
    await queued(remove(movie), T12, T13);
    expect(itemOf(await queued(setStatus(movie, 'watched'), T1130, T13), movie)).toBeUndefined();
  });

  it('an older removal never moves the marker back', async () => {
    await online(setStatus(movie, 'want'), T0);
    await online(remove(movie), T12);
    await queued(remove(movie), T10, T13);
    expect(await markers()).toMatchObject([{ kind: 'item', removedAt: expect.stringContaining('2026-11-20') }]);
    expect(Date.parse((await markers())[0]!.removedAt)).toBe(Date.parse(T12));
    expect(itemOf(await queued(setStatus(movie, 'watched'), T11, T13), movie)).toBeUndefined();
  });
});

describe('a write newer than the removal brings the row back and clears the marker', () => {
  it('item, rating and mark', async () => {
    await online(setStatus(movie, 'want'), T0);
    await online(rate(tv, 6), T0);
    await online(episodes(true, 1, 2), T0);
    await queued(remove(movie), T10, T11);
    await queued(unrate(tv), T10, T11);
    await queued(episodes(false, 1), T10, T11);
    expect(await markers()).toHaveLength(3);

    await queued(setStatus(movie, 'watched'), T1030, T12);
    await queued(rate(tv, 8), T1030, T12);
    const state = await queued(episodes(true, 1), T1030, T12);
    expect(itemOf(state, movie)).toMatchObject({ status: 'watched', updatedAt: T1030 });
    expect(ratingOf(state, tv)).toMatchObject({ score: 8, updatedAt: T1030 });
    expect(state.episodes.find((e) => e.episodeNumber === 1)).toMatchObject({ watchedAt: T1030 });
    expect(await markers()).toEqual([]);
  });

  it('marks of a removed series come back with a newer setEpisodes, and the series with them', async () => {
    await online(episodes(true, 1), T0);
    await online(remove(tv), T10);
    const state = await queued(episodes(true, 2), T1030, T11);
    expect(itemOf(state, tv)).toMatchObject({ status: 'watching', addedAt: T1030 });
    expect(episodeNumbers(state)).toEqual([2]);
  });

  it('records the removal markers with the shape of the table', async () => {
    await online(setStatus(movie, 'want'), T0);
    await online(rate(movie, 7), T0);
    await online(episodes(true, 1, 2), T0);
    await online(remove(movie), T10);
    await online(unrate(movie), T10);
    await online(episodes(false, 2), T10);
    const rows = (await markers()).map((m) => ({ ...m, removedAt: Date.parse(m.removedAt) }));
    const at = Date.parse(T10);
    expect(rows).toEqual(
      expect.arrayContaining([
        { kind: 'item', mediaType: 'movie', tmdbId: 550, seasonNumber: null, episodeNumber: null, removedAt: at },
        { kind: 'rating', mediaType: 'movie', tmdbId: 550, seasonNumber: null, episodeNumber: null, removedAt: at },
        { kind: 'mark', mediaType: 'tv', tmdbId: 1398, seasonNumber: 1, episodeNumber: 2, removedAt: at },
      ]),
    );
    expect(rows).toHaveLength(3);
  });

  it('removing a series writes one marker for the series, not one per episode', async () => {
    await online(episodes(true, 1, 2, 3), T0);
    await online(remove(tv), T10);
    expect(await markers()).toMatchObject([{ kind: 'item', mediaType: 'tv', tmdbId: 1398, seasonNumber: null }]);
  });
});

describe('the time of the action', () => {
  it('a time in the future is stored as now', async () => {
    const state = await queued(setStatus(movie, 'want'), '2999-01-01T00:00:00.000Z', T12);
    expect(itemOf(state, movie)).toMatchObject({ addedAt: T12, updatedAt: T12 });
  });

  it('a time in another offset is stored as the same instant', async () => {
    const state = await queued(setStatus(movie, 'want'), '2026-11-20T07:00:00.000-03:00', T12);
    expect(itemOf(state, movie)).toMatchObject({ updatedAt: T10 });
  });

  it('a time 30 days old is still taken; 31 days old is refused as stale, writing nothing', async () => {
    await expect(queued(setStatus(movie, 'want'), daysBefore(T12, 31), T12)).rejects.toBeInstanceOf(LibraryStaleError);
    expect((await loadLibrary(db, userId)).items).toEqual([]);
    const state = await queued(setStatus(movie, 'want'), daysBefore(T12, 30), T12);
    expect(itemOf(state, movie)).toMatchObject({ updatedAt: daysBefore(T12, 30) });
  });
});

describe('the same command twice (commandId)', () => {
  const ID = '6c1f0c1e-3d0b-4c5e-8a5f-1b2c3d4e5f60';

  it('writes once; the second answer is the library as stored now, with the pre-image of that state', async () => {
    await queued(rate(tv, 6), T10, T11, ID);
    await online(rate(tv, 9), T12); // another device, after
    const again = await applyLibraryCommand(db, userId, rate(tv, 6), T13, { at: T10, commandId: ID });
    expect(ratingOf(again.state, tv)).toMatchObject({ score: 9, updatedAt: T12 });
    expect(again.previous.rating).toMatchObject({ score: 9 });
    expect(await appliedCount()).toBe(1);
  });

  it('a removal sent twice is applied once: the second never deletes what was added in between', async () => {
    await online(setStatus(movie, 'want'), T0);
    await queued(remove(movie), T12, T12, ID);
    await online(setStatus(movie, 'watched'), T13);
    const state = await queued(remove(movie), T13, T13, ID);
    expect(itemOf(state, movie)).toMatchObject({ status: 'watched' });
  });

  it('a retry of an applied command answers the stored state even once its time is past 30 days (never stale)', async () => {
    const later = new Date(Date.parse(T12) + 2 * DAY).toISOString();
    await queued(rate(tv, 6), daysBefore(T12, 29), T12, ID);
    await online(rate(tv, 9), T13);
    const again = await applyLibraryCommand(db, userId, rate(tv, 6), later, { at: daysBefore(T12, 29), commandId: ID });
    expect(ratingOf(again.state, tv)).toMatchObject({ score: 9, updatedAt: T13 });
    expect(await appliedCount()).toBe(1);
  });

  it('is recorded even when the command changes nothing, so a later retry stays a no-op', async () => {
    await queued(unrate(movie), T10, T11, ID);
    expect(await appliedCount()).toBe(1);
  });

  it('two identical requests at once: one applies, the other answers the stored state', async () => {
    const [a, b] = await Promise.all([queued(rate(tv, 6), T10, T11, ID), queued(rate(tv, 6), T10, T11, ID)]);
    expect(ratingOf(a, tv)).toMatchObject({ score: 6 });
    expect(ratingOf(b, tv)).toMatchObject({ score: 6 });
    expect(await appliedCount()).toBe(1);
  });

  it('a duplicate landing between the load and the write rolls the whole write back and answers the stored state', async () => {
    await online(setStatus(movie, 'want'), T0);
    const racing = Object.assign(Object.create(db) as object, {
      transaction: async (fn: Parameters<typeof db.transaction>[0]) => {
        // The other copy of the request commits first.
        await db.insert(appliedCommands).values({ userId, commandId: ID, appliedAt: T11 });
        return db.transaction(fn);
      },
    }) as typeof db;
    const { state } = await applyLibraryCommand(racing, userId, setStatus(movie, 'watched'), T11, { at: T11, commandId: ID });
    expect(itemOf(state, movie)).toMatchObject({ status: 'want' });
    expect(itemOf(await loadLibrary(db, userId), movie)).toMatchObject({ status: 'want' });
    expect(await appliedCount()).toBe(1);
  });

  it('a different id applies normally', async () => {
    await queued(rate(tv, 6), T10, T11, ID);
    await queued(rate(tv, 8), T12, T12, '6c1f0c1e-3d0b-4c5e-8a5f-1b2c3d4e5f61');
    expect(ratingOf(await loadLibrary(db, userId), tv)).toMatchObject({ score: 8 });
    expect(await appliedCount()).toBe(2);
  });
});

describe('opportunistic cleanup', () => {
  it('a marker older than 60 days and an applied command older than 30 days go with the next write', async () => {
    await db.insert(libraryRemovals).values([
      { userId, kind: 'item', mediaType: 'movie', tmdbId: 1, removedAt: daysBefore(T12, 61) },
      { userId, kind: 'item', mediaType: 'movie', tmdbId: 2, removedAt: daysBefore(T12, 59) },
    ]);
    await db.insert(appliedCommands).values([
      { userId, commandId: 'old', appliedAt: daysBefore(T12, 31) },
      { userId, commandId: 'recent', appliedAt: daysBefore(T12, 29) },
    ]);
    await online(setStatus(movie, 'want'), T12);
    expect((await markers()).map((m) => m.tmdbId)).toEqual([2]);
    const ids = await db.select({ id: appliedCommands.commandId }).from(appliedCommands).where(eq(appliedCommands.userId, userId));
    expect(ids.map((r) => r.id)).toEqual(['recent']);
  });

  it("never touches another user's markers", async () => {
    const other = `${userId}-other`;
    await db.insert(users).values({ id: other });
    await db.insert(libraryRemovals).values({ userId: other, kind: 'item', mediaType: 'movie', tmdbId: 1, removedAt: daysBefore(T12, 61) });
    await online(setStatus(movie, 'want'), T12);
    const [row] = await db.select({ n: count() }).from(libraryRemovals).where(eq(libraryRemovals.userId, other));
    expect(row!.n).toBe(1);
  });
});

describe('removal markers and the rest of the library', () => {
  it('limits count live rows only: 5,000 markers never block adding an item', async () => {
    const rows = Array.from({ length: 5_000 }, (_, i) => ({
      userId,
      kind: 'item',
      mediaType: 'movie',
      tmdbId: 100_000 + i,
      removedAt: T0,
    }));
    for (let i = 0; i < rows.length; i += 1000) await db.insert(libraryRemovals).values(rows.slice(i, i + 1000));
    expect(itemOf(await online(setStatus(movie, 'want'), T10), movie)).toBeDefined();
  });

  it('an undo of a removal puts the title back (its fingerprint matches) and clears the markers', async () => {
    await online(episodes(true, 1), T0);
    const previous = await loadLibrary(db, userId);
    const saved = await online(remove(tv), T10);
    const restore: LibraryCommand = {
      type: 'restore',
      ref: tv,
      item: itemOf(previous, tv)!,
      rating: null,
      marks: previous.episodes,
      expected: titleFingerprint(saved, tv),
    };
    const state = await online(restore, T11);
    expect(itemOf(state, tv)).toEqual(itemOf(previous, tv));
    expect(state.episodes).toEqual(previous.episodes);
    expect(await markers()).toEqual([]);
    // With the removal undone, a write done before it counts again.
    expect(episodeNumbers(await queued(episodes(true, 2), T0, T12))).toEqual([1, 2]);
  });

  it('an undo after another device removed the title is refused, and the title stays out', async () => {
    await online(setStatus(movie, 'want'), T0);
    const previous = await loadLibrary(db, userId);
    const saved = await online(setStatus(movie, 'watched'), T10);
    await online(remove(movie), T11); // another device
    const restore: LibraryCommand = {
      type: 'restore',
      ref: movie,
      item: itemOf(previous, movie)!,
      rating: null,
      marks: [],
      expected: titleFingerprint(saved, movie),
    };
    await expect(online(restore, T12)).rejects.toBeInstanceOf(LibraryConflictError);
    expect((await loadLibrary(db, userId)).items).toEqual([]);
  });

  it('the stored rows never mention a marker: every read shows live rows only', async () => {
    await online(setStatus(movie, 'want'), T0);
    await online(remove(movie), T10);
    const [row] = await db
      .select({ n: count() })
      .from(libraryItems)
      .where(and(eq(libraryItems.userId, userId), eq(libraryItems.tmdbId, 550)));
    expect(row!.n).toBe(0);
    expect(await loadLibrary(db, userId)).toEqual({ version: 1, items: [], episodes: [], ratings: [] });
    expect(await db.select().from(ratings).where(eq(ratings.userId, userId))).toEqual([]);
    expect(await db.select().from(episodeProgress).where(eq(episodeProgress.userId, userId))).toEqual([]);
  });
});
