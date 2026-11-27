// @vitest-environment node
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, type LibraryCommand } from '@/features/library/commands';
import { titleFingerprint, type TitleFingerprint } from '@/features/library/fingerprint';
import { parseLibraryState } from '@/features/library/schema';
import { EMPTY_LIBRARY, type LibraryState, type TitleRef } from '@/features/library/types';
import { episodeProgress, libraryItems, ratings, users } from '@/server/db/schema';
import { createTestDb } from '@/test/db';
import { LibraryConflictError, LibraryInvalidError, LibraryLimitError } from './errors';
import { applyLibraryCommand, loadLibrary } from './store';

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
  userId = `user-${++seq}`;
  await db.insert(users).values({ id: userId });
});

const T0 = '2026-11-20T10:00:00.000Z';
const T1 = '2026-11-20T11:00:00.000Z';
const T2 = '2026-11-20T12:00:00.000Z';
const T3 = '2026-11-20T13:00:00.000Z';
const snapshot = { title: 'Família Soprano', posterPath: '/s.jpg', releaseDate: '1999-01-10', genreIds: [18, 80] };
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const tv: TitleRef = { mediaType: 'tv', tmdbId: 1398 };
const progress = {
  tvId: 1398,
  ended: true,
  seasons: [{ seasonNumber: 1, episodeCount: 3 }],
  lastAired: { seasonNumber: 1, episodeNumber: 3 },
  nextToAir: null,
};
const setStatus = (ref: TitleRef, status: 'want' | 'watching' | 'watched'): LibraryCommand => ({
  type: 'setStatus',
  ref,
  status,
  snapshot,
});
const episodes = (watched: boolean, ...eps: number[]): LibraryCommand => ({
  type: 'setEpisodes',
  tvId: tv.tmdbId,
  marks: eps.map((episodeNumber) => ({ seasonNumber: 1, episodeNumber })),
  watched,
  snapshot,
  progress,
});

/** Order-free view of a state (the database returns rows in no particular order). */
function canonical(state: LibraryState) {
  const by = <T>(key: (row: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));
  return {
    version: state.version,
    items: [...state.items].sort(by((i) => `${i.mediaType}:${i.tmdbId}`)),
    ratings: [...state.ratings].sort(by((r) => `${r.mediaType}:${r.tmdbId}`)),
    episodes: [...state.episodes].sort(by((e) => `${e.tvId}:${e.seasonNumber}:${String(e.episodeNumber).padStart(5, '0')}`)),
  };
}

const run = async (command: LibraryCommand, now: string) => (await applyLibraryCommand(db, userId, command, now)).state;

async function countRows(table: typeof libraryItems | typeof ratings | typeof episodeProgress) {
  const [row] = await db.select({ n: count() }).from(table).where(eq(table.userId, userId));
  return row!.n;
}

describe('loadLibrary', () => {
  it('is the empty library for a new user', async () => {
    expect(await loadLibrary(db, userId)).toEqual(EMPTY_LIBRARY);
  });

  it('returns ISO timestamps that pass the library schema, even for rows stamped by Postgres', async () => {
    await db.insert(libraryItems).values({ userId, mediaType: 'movie', tmdbId: 1, status: 'want', title: 'Filme' });
    await db.insert(episodeProgress).values({ userId, tvId: 2, seasonNumber: 1, episodeNumber: 1 });
    await db.insert(ratings).values({ userId, mediaType: 'movie', tmdbId: 1, score: 8 });
    const state = await loadLibrary(db, userId);
    expect(parseLibraryState(state)).toEqual(state);
    expect(state.items[0]!.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(state.episodes[0]!.watchedAt).toMatch(/Z$/);
    expect(state.ratings[0]!.ratedAt).toMatch(/Z$/);
  });

  it('round-trips every field and timestamp exactly', async () => {
    await run(setStatus(movie, 'watched'), T1);
    await run({ type: 'rate', ref: movie, score: 9, snapshot }, T2);
    await run(episodes(true, 1), T3);
    const state = await loadLibrary(db, userId);
    expect(canonical(state)).toEqual(
      canonical({
        version: 1,
        items: [
          { ...movie, status: 'watched', addedAt: T1, updatedAt: T1, watchedAt: T1, snapshot },
          { ...tv, status: 'watching', addedAt: T3, updatedAt: T3, watchedAt: null, snapshot },
        ],
        ratings: [{ ...movie, score: 9, ratedAt: T2, updatedAt: T2 }],
        episodes: [{ tvId: tv.tmdbId, seasonNumber: 1, episodeNumber: 1, watchedAt: T3 }],
      }),
    );
  });

  it('leaves out (and keeps in the database) a row the schema cannot read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A movie cannot be 'watching': the database allows it, the library schema does not.
    await db.insert(libraryItems).values({ userId, mediaType: 'movie', tmdbId: 7, status: 'watching', title: 'Filme' });
    expect((await loadLibrary(db, userId)).items).toEqual([]);
    await run(setStatus(movie, 'want'), T1);
    expect(await countRows(libraryItems)).toBe(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(userId);
    warn.mockRestore();
  });
});

describe('applyLibraryCommand', () => {
  it('returns the same state as the local reducer for setStatus, setEpisodes and removing a series', async () => {
    let local = EMPTY_LIBRARY;
    const steps: [LibraryCommand, string][] = [
      [setStatus(tv, 'want'), T0],
      [episodes(true, 1, 2), T1],
      [{ type: 'rate', ref: tv, score: 8, snapshot }, T1],
      [episodes(true, 3), T2],
      [{ type: 'remove', ref: tv }, T3],
    ];
    for (const [command, now] of steps) {
      local = applyCommand(local, command, now);
      expect(canonical(await run(command, now))).toEqual(canonical(local));
      expect(canonical(await loadLibrary(db, userId))).toEqual(canonical(local));
    }
    // Removing the series deleted its marks and kept its rating.
    expect(await countRows(episodeProgress)).toBe(0);
    expect(await countRows(ratings)).toBe(1);
    expect(await countRows(libraryItems)).toBe(0);
  });

  it('two commands on different titles never overwrite each other, in sequence or at once', async () => {
    await run(setStatus(movie, 'want'), T1);
    await run(setStatus(tv, 'want'), T2);
    await Promise.all([
      run(setStatus({ mediaType: 'movie', tmdbId: 1 }, 'want'), T3),
      run(setStatus({ mediaType: 'movie', tmdbId: 2 }, 'want'), T3),
    ]);
    const ids = (await loadLibrary(db, userId)).items.map((i) => i.tmdbId).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 550, 1398]);
  });

  it('a stale write never overrides a newer item, rating or mark, and the answer shows what was kept', async () => {
    await run(setStatus(movie, 'watched'), T2);
    await run({ type: 'rate', ref: movie, score: 9, snapshot }, T2);
    await run(episodes(true, 1), T2);
    // Requests that reached the server earlier (T1) but write later.
    expect((await run(setStatus(movie, 'want'), T1)).items.find((i) => i.tmdbId === 550)?.status).toBe('watched');
    await run({ type: 'rate', ref: movie, score: 3, snapshot }, T1);
    await run(episodes(true, 1), T1);
    const state = await loadLibrary(db, userId);
    expect(state.items.find((i) => i.tmdbId === 550)).toMatchObject({ status: 'watched', updatedAt: T2 });
    expect(state.ratings[0]).toMatchObject({ score: 9, updatedAt: T2 });
    expect(state.episodes[0]).toMatchObject({ watchedAt: T2 });
  });

  it('a newer write replaces the row', async () => {
    await run(setStatus(movie, 'want'), T1);
    await run(setStatus(movie, 'watched'), T2);
    expect((await loadLibrary(db, userId)).items[0]).toMatchObject({ status: 'watched', updatedAt: T2, addedAt: T1 });
  });

  it("never touches another user's rows", async () => {
    const other = `${userId}-other`;
    await db.insert(users).values({ id: other });
    await applyLibraryCommand(db, other, setStatus(movie, 'want'), T1);
    await run(setStatus(movie, 'watched'), T2);
    await run({ type: 'remove', ref: movie }, T3);
    expect((await loadLibrary(db, other)).items).toMatchObject([{ status: 'want' }]);
  });

  it('turns a command the reducer refuses into LibraryInvalidError, writing nothing', async () => {
    await expect(run(setStatus(movie, 'watching'), T1)).rejects.toBeInstanceOf(LibraryInvalidError);
    await expect(run({ type: 'rate', ref: movie, score: 0, snapshot }, T1)).rejects.toBeInstanceOf(LibraryInvalidError);
    expect(await countRows(libraryItems)).toBe(0);
  });
});

describe('conditional restore', () => {
  /** Runs an undoable action like useLibraryActions does, returning the restore it would send. */
  async function undoable(ref: TitleRef, action: LibraryCommand, now: string) {
    const previous = await loadLibrary(db, userId);
    const saved = await run(action, now);
    const restore = (expected: TitleFingerprint | null = titleFingerprint(saved, ref)): LibraryCommand => ({
      type: 'restore',
      ref,
      item: previous.items.find((i) => i.mediaType === ref.mediaType && i.tmdbId === ref.tmdbId) ?? null,
      rating: previous.ratings.find((r) => r.mediaType === ref.mediaType && r.tmdbId === ref.tmdbId) ?? null,
      marks: ref.mediaType === 'tv' ? previous.episodes.filter((e) => e.tvId === ref.tmdbId) : [],
      ...(expected ? { expected } : {}),
    });
    return { previous, saved, restore };
  }

  it('puts the older title back when nothing changed since the action', async () => {
    await run(setStatus(movie, 'want'), T0);
    const { previous, restore } = await undoable(movie, setStatus(movie, 'watched'), T1);
    expect((await run(restore(), T2)).items).toEqual(previous.items);
    expect((await loadLibrary(db, userId)).items).toEqual(previous.items);
  });

  it('409 when another device changed the item since the action, writing nothing', async () => {
    await run(setStatus(movie, 'want'), T0);
    const { restore } = await undoable(movie, setStatus(movie, 'watched'), T1);
    await run(setStatus(movie, 'want'), T2); // another device
    await expect(run(restore(), T3)).rejects.toBeInstanceOf(LibraryConflictError);
    expect((await loadLibrary(db, userId)).items[0]).toMatchObject({ status: 'want', updatedAt: T2 });
  });

  it('409 when another device added a mark, even without touching the item', async () => {
    await run(episodes(true, 1), T0);
    const { restore } = await undoable(tv, episodes(true, 2), T1);
    await db.insert(episodeProgress).values({ userId, tvId: tv.tmdbId, seasonNumber: 2, episodeNumber: 1, watchedAt: T2 });
    await expect(run(restore(), T3)).rejects.toBeInstanceOf(LibraryConflictError);
    expect(await countRows(episodeProgress)).toBe(3);
  });

  it('409 when another device re-rated after an undone unrate, keeping that rating', async () => {
    await run({ type: 'rate', ref: tv, score: 6, snapshot }, T0);
    const { restore } = await undoable(tv, { type: 'unrate', ref: tv }, T1);
    await run({ type: 'rate', ref: tv, score: 9, snapshot }, T2); // another device
    await expect(run(restore(), T3)).rejects.toBeInstanceOf(LibraryConflictError);
    expect((await loadLibrary(db, userId)).ratings).toMatchObject([{ score: 9, updatedAt: T2 }]);
  });

  it('409 when the item the action removed is back, or the item it left is gone', async () => {
    await run(setStatus(movie, 'want'), T0);
    const removal = await undoable(movie, { type: 'remove', ref: movie }, T1);
    await run(setStatus(movie, 'watched'), T2);
    await expect(run(removal.restore(), T3)).rejects.toBeInstanceOf(LibraryConflictError);

    const change = await undoable(movie, setStatus(movie, 'want'), T2);
    await run({ type: 'remove', ref: movie }, T3);
    await expect(run(change.restore(), T3)).rejects.toBeInstanceOf(LibraryConflictError);
    expect(await countRows(libraryItems)).toBe(0);
  });

  it('accepts the same instants written in another offset', async () => {
    await run(setStatus(movie, 'want'), T0);
    const { restore, saved } = await undoable(movie, setStatus(movie, 'watched'), T1);
    const expected = { ...titleFingerprint(saved, movie), itemUpdatedAt: '2026-11-20T08:00:00.000-03:00' };
    await expect(run(restore(expected), T2)).resolves.toBeDefined();
  });

  it('without expected, restores unconditionally (older clients)', async () => {
    await run(setStatus(movie, 'want'), T0);
    const { previous, restore } = await undoable(movie, setStatus(movie, 'watched'), T1);
    await run(setStatus(movie, 'want'), T2);
    expect((await run(restore(null), T3)).items).toEqual(previous.items);
  });

  it('restores the deleted marks and rating of a removed series', async () => {
    await run(episodes(true, 1, 2), T0);
    await run({ type: 'rate', ref: tv, score: 7, snapshot }, T0);
    const { previous, restore } = await undoable(tv, { type: 'remove', ref: tv }, T1);
    expect(canonical(await run(restore(), T2))).toEqual(canonical(previous));
  });

  it('never stores a restored timestamp later than now, so later writes still apply', async () => {
    const tomorrow = '2026-11-21T12:00:00.000Z';
    const command: LibraryCommand = {
      type: 'restore',
      ref: tv,
      item: { ...tv, status: 'watching', addedAt: tomorrow, updatedAt: tomorrow, watchedAt: null, snapshot },
      rating: { ...tv, score: 5, ratedAt: tomorrow, updatedAt: tomorrow },
      marks: [{ tvId: tv.tmdbId, seasonNumber: 1, episodeNumber: 1, watchedAt: tomorrow }],
    };
    const restored = await run(command, T1);
    expect(restored.items[0]).toMatchObject({ addedAt: T1, updatedAt: T1 });
    expect(restored.ratings[0]).toMatchObject({ ratedAt: T1, updatedAt: T1 });
    expect(restored.episodes[0]).toMatchObject({ watchedAt: T1 });
    await run(setStatus(tv, 'want'), T2);
    await run({ type: 'rate', ref: tv, score: 8, snapshot }, T2);
    const state = await loadLibrary(db, userId);
    expect(state.items[0]).toMatchObject({ status: 'want', updatedAt: T2 });
    expect(state.ratings[0]).toMatchObject({ score: 8 });
  });

  it('re-checks inside the transaction: a write landing after the load aborts the whole restore', async () => {
    await run(episodes(true, 1), T0);
    const { restore } = await undoable(tv, episodes(true, 2), T1);
    // Another device writes between this request's load and its batch.
    const racing = Object.assign(Object.create(db) as object, {
      transaction: async (fn: Parameters<typeof db.transaction>[0]) => {
        await db.insert(episodeProgress).values({ userId, tvId: tv.tmdbId, seasonNumber: 3, episodeNumber: 1, watchedAt: T2 });
        return db.transaction(fn);
      },
    }) as typeof db;
    await expect(applyLibraryCommand(racing, userId, restore(), T3)).rejects.toBeInstanceOf(LibraryConflictError);
    const state = await loadLibrary(db, userId);
    // Nothing of the restore was written: the item is still the action's, and all three marks are kept.
    expect(state.items[0]).toMatchObject({ updatedAt: T1 });
    expect(state.episodes).toHaveLength(3);
  });
});

describe('per-user limits', () => {
  async function seedItems(n: number) {
    const rows = Array.from({ length: n }, (_, i) => ({
      userId,
      mediaType: 'movie',
      tmdbId: 100_000 + i,
      status: 'want',
      title: 'Filme',
      addedAt: T0,
      updatedAt: T0,
    }));
    for (let i = 0; i < rows.length; i += 1000) await db.insert(libraryItems).values(rows.slice(i, i + 1000));
  }

  it('413 (LibraryLimitError) past 5,000 items, writing nothing; changing an existing item still works', async () => {
    await seedItems(5_000);
    await expect(run(setStatus(movie, 'want'), T1)).rejects.toBeInstanceOf(LibraryLimitError);
    expect(await countRows(libraryItems)).toBe(5_000);
    await run(setStatus({ mediaType: 'movie', tmdbId: 100_000 }, 'watched'), T1);
    const [row] = await db
      .select()
      .from(libraryItems)
      .where(and(eq(libraryItems.userId, userId), eq(libraryItems.tmdbId, 100_000)));
    expect(row!.status).toBe('watched');
  });

  it('never blocks shrinking a library that is already over the limit', async () => {
    await seedItems(5_001);
    await run({ type: 'remove', ref: { mediaType: 'movie', tmdbId: 100_000 } }, T1);
    expect(await countRows(libraryItems)).toBe(5_000);
  });

  it('413 past 5,000 ratings', async () => {
    const rows = Array.from({ length: 5_000 }, (_, i) => ({ userId, mediaType: 'tv', tmdbId: 100_000 + i, score: 5 }));
    for (let i = 0; i < rows.length; i += 1000) await db.insert(ratings).values(rows.slice(i, i + 1000));
    await expect(run({ type: 'rate', ref: tv, score: 8, snapshot }, T1)).rejects.toBeInstanceOf(LibraryLimitError);
    expect(await countRows(ratings)).toBe(5_000);
  });

  it('413 past 60,000 episode marks', async () => {
    const rows = Array.from({ length: 60_000 }, (_, i) => ({
      userId,
      tvId: 1 + Math.floor(i / 1000),
      seasonNumber: 1,
      episodeNumber: 1 + (i % 1000),
      watchedAt: T0,
    }));
    for (let i = 0; i < rows.length; i += 2000) await db.insert(episodeProgress).values(rows.slice(i, i + 2000));
    await expect(run(episodes(true, 1), T1)).rejects.toBeInstanceOf(LibraryLimitError);
    expect(await countRows(episodeProgress)).toBe(60_000);
    expect(await countRows(libraryItems)).toBe(0);
  }, 60_000);
});
