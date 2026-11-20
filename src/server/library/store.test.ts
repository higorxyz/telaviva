// @vitest-environment node
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand, type LibraryCommand } from '@/features/library/commands';
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

const run = (command: LibraryCommand, now: string) => applyLibraryCommand(db, userId, command, now);

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
    await db.insert(libraryItems).values({ userId, mediaType: 'movie', tmdbId: 7, status: 'want', title: '' });
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
  async function undoable() {
    await run(setStatus(movie, 'want'), T0);
    const previous = await loadLibrary(db, userId);
    const after = await run(setStatus(movie, 'watched'), T1);
    return {
      before: previous.items[0]!,
      postUpdatedAt: after.items[0]!.updatedAt,
      restore: (expectedUpdatedAt?: string | null): LibraryCommand => ({
        type: 'restore',
        ref: movie,
        item: previous.items[0]!,
        rating: null,
        marks: [],
        ...(expectedUpdatedAt === undefined ? {} : { expectedUpdatedAt }),
      }),
    };
  }

  it('puts the older item back when nothing changed since the action', async () => {
    const { before, postUpdatedAt, restore } = await undoable();
    expect(postUpdatedAt).toBe(T1);
    const state = await run(restore(postUpdatedAt), T2);
    expect(state.items).toEqual([before]);
    expect((await loadLibrary(db, userId)).items).toEqual([before]);
  });

  it('refuses with LibraryConflictError when the item changed since the action, writing nothing', async () => {
    const { restore } = await undoable();
    await run(setStatus(movie, 'want'), T2); // another device
    await expect(run(restore(T1), T3)).rejects.toBeInstanceOf(LibraryConflictError);
    expect((await loadLibrary(db, userId)).items[0]).toMatchObject({ status: 'want', updatedAt: T2 });
  });

  it('null expects the item to be absent; a timestamp expects it to exist', async () => {
    const { restore } = await undoable();
    await expect(run(restore(null), T2)).rejects.toBeInstanceOf(LibraryConflictError);
    await run({ type: 'remove', ref: movie }, T2);
    await expect(run(restore(T1), T3)).rejects.toBeInstanceOf(LibraryConflictError);
    expect(await countRows(libraryItems)).toBe(0);
    await run(restore(null), T3);
    expect(await countRows(libraryItems)).toBe(1);
  });

  it('accepts the same instant written in another offset', async () => {
    const { restore } = await undoable();
    await expect(run(restore('2026-11-20T08:00:00.000-03:00'), T2)).resolves.toBeDefined();
  });

  it('without expectedUpdatedAt, restores unconditionally (older clients)', async () => {
    const { before, restore } = await undoable();
    await run(setStatus(movie, 'want'), T2);
    expect((await run(restore(), T3)).items).toEqual([before]);
  });

  it('restores deleted marks and rating of a removed series', async () => {
    await run(episodes(true, 1, 2), T0);
    await run({ type: 'rate', ref: tv, score: 7, snapshot }, T0);
    const previous = await loadLibrary(db, userId);
    await run({ type: 'remove', ref: tv }, T1);
    const command: LibraryCommand = {
      type: 'restore',
      ref: tv,
      item: previous.items[0]!,
      rating: previous.ratings[0]!,
      marks: previous.episodes,
      expectedUpdatedAt: null,
    };
    expect(canonical(await run(command, T2))).toEqual(canonical(previous));
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
