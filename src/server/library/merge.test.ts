// @vitest-environment node
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryCommand } from '@/features/library/commands';
import { mergeLibraries } from '@/features/library/merge';
import { EMPTY_LIBRARY, type LibraryItem, type LibraryState, type TitleRef } from '@/features/library/types';
import { episodeProgress, libraryItems, ratings, users } from '@/server/db/schema';
import { createTestDb } from '@/test/db';
import { clampState } from './clamp';
import { diffStates } from './diff';
import { LibraryLimitError } from './errors';
import { mergeGuestLibrary } from './merge';
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
const FUTURE = '2999-01-01T00:00:00.000Z';
const snapshot = { title: 'Família Soprano', posterPath: '/s.jpg', releaseDate: '1999-01-10', genreIds: [18, 80] };
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const tv: TitleRef = { mediaType: 'tv', tmdbId: 1398 };
const item = (ref: TitleRef, over: Partial<LibraryItem> = {}): LibraryItem => ({
  ...ref,
  status: 'want',
  addedAt: T0,
  updatedAt: T0,
  watchedAt: null,
  snapshot,
  ...over,
});
const mark = (episodeNumber: number, watchedAt: string) => ({ tvId: tv.tmdbId, seasonNumber: 1, episodeNumber, watchedAt });
const state = (over: Partial<LibraryState>): LibraryState => ({ ...EMPTY_LIBRARY, ...over });
const setStatus = (ref: TitleRef, status: 'want' | 'watched'): LibraryCommand => ({ type: 'setStatus', ref, status, snapshot });

const merge = (guest: LibraryState, now = T3) => mergeGuestLibrary(db, userId, guest, now);

function canonical(s: LibraryState) {
  const by = <T>(key: (row: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));
  return {
    version: s.version,
    items: [...s.items].sort(by((i) => `${i.mediaType}:${i.tmdbId}`)),
    ratings: [...s.ratings].sort(by((r) => `${r.mediaType}:${r.tmdbId}`)),
    episodes: [...s.episodes].sort(by((e) => `${e.tvId}:${e.seasonNumber}:${String(e.episodeNumber).padStart(5, '0')}`)),
  };
}

async function countRows(table: typeof libraryItems | typeof ratings | typeof episodeProgress) {
  const [row] = await db.select({ n: count() }).from(table).where(eq(table.userId, userId));
  return row!.n;
}

describe('clampState', () => {
  it('brings every timestamp later than now back to now, and leaves the others alone', () => {
    const guest = state({
      items: [item(movie, { addedAt: FUTURE, updatedAt: FUTURE, watchedAt: FUTURE, status: 'watched' }), item(tv)],
      ratings: [{ ...movie, score: 8, ratedAt: FUTURE, updatedAt: FUTURE }],
      episodes: [mark(1, FUTURE), mark(2, T0)],
    });
    expect(clampState(guest, T2)).toEqual(
      state({
        items: [item(movie, { addedAt: T2, updatedAt: T2, watchedAt: T2, status: 'watched' }), item(tv)],
        ratings: [{ ...movie, score: 8, ratedAt: T2, updatedAt: T2 }],
        episodes: [mark(1, T2), mark(2, T0)],
      }),
    );
  });
});

describe('mergeGuestLibrary', () => {
  it('stores the merge of the account and the guest and answers it as stored', async () => {
    await applyLibraryCommand(db, userId, setStatus(movie, 'want'), T0);
    await applyLibraryCommand(db, userId, { type: 'rate', ref: movie, score: 6, snapshot }, T0);
    const guest = state({
      items: [item(movie, { status: 'watched', updatedAt: T1, watchedAt: T1 }), item(tv, { status: 'watching' })],
      ratings: [{ ...movie, score: 9, ratedAt: T1, updatedAt: T1 }],
      episodes: [mark(1, T1), mark(2, T1)],
    });
    const account = await loadLibrary(db, userId);
    const answer = await merge(guest);
    expect(canonical(answer)).toEqual(canonical(mergeLibraries(account, guest)));
    expect(canonical(await loadLibrary(db, userId))).toEqual(canonical(answer));
  });

  it('never deletes an account row the guest does not have', async () => {
    await applyLibraryCommand(db, userId, setStatus(movie, 'watched'), T0);
    await applyLibraryCommand(db, userId, { type: 'rate', ref: movie, score: 6, snapshot }, T0);
    await db.insert(episodeProgress).values({ userId, ...mark(1, T0) });
    const account = await loadLibrary(db, userId);
    const guest = state({ items: [item({ mediaType: 'movie', tmdbId: 1 })] });
    // The diff of a merge never has deletes...
    const diff = diffStates(account, mergeLibraries(account, guest));
    expect([diff.deleteItems, diff.deleteRatings, diff.deleteMarks]).toEqual([[], [], []]);
    // ...and the stored library keeps every row it had.
    await merge(guest);
    expect(await countRows(libraryItems)).toBe(account.items.length + 1);
    expect(await countRows(ratings)).toBe(1);
    expect(await countRows(episodeProgress)).toBe(1);
  });

  it('is idempotent: the same guest again writes nothing and changes nothing', async () => {
    await applyLibraryCommand(db, userId, setStatus(movie, 'want'), T0);
    const guest = state({
      items: [item(movie, { status: 'watched', updatedAt: T1, watchedAt: T1 }), item(tv)],
      episodes: [mark(1, T1)],
    });
    const first = await merge(guest);
    const transaction = vi.spyOn(db, 'transaction');
    try {
      const second = await merge(guest, '2026-11-20T14:00:00.000Z');
      expect(canonical(second)).toEqual(canonical(first));
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
    expect(await countRows(libraryItems)).toBe(2);
    expect(await countRows(episodeProgress)).toBe(1);
  });

  it('an empty guest writes nothing and answers the account', async () => {
    await applyLibraryCommand(db, userId, setStatus(movie, 'want'), T0);
    const transaction = vi.spyOn(db, 'transaction');
    try {
      expect(await merge(EMPTY_LIBRARY)).toEqual(await loadLibrary(db, userId));
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      transaction.mockRestore();
    }
  });

  it('clamps future guest timestamps to now, so later writes still apply', async () => {
    const guest = state({
      items: [item(tv, { status: 'watching', addedAt: FUTURE, updatedAt: FUTURE })],
      ratings: [{ ...tv, score: 5, ratedAt: FUTURE, updatedAt: FUTURE }],
      episodes: [mark(1, FUTURE)],
    });
    const merged = await merge(guest, T1);
    expect(merged.items[0]).toMatchObject({ addedAt: T1, updatedAt: T1 });
    expect(merged.ratings[0]).toMatchObject({ ratedAt: T1, updatedAt: T1 });
    expect(merged.episodes[0]).toMatchObject({ watchedAt: T1 });
    await applyLibraryCommand(db, userId, setStatus(tv, 'want'), T2);
    await applyLibraryCommand(db, userId, { type: 'rate', ref: tv, score: 8, snapshot }, T2);
    const after = await loadLibrary(db, userId);
    expect(after.items[0]).toMatchObject({ status: 'want', updatedAt: T2 });
    expect(after.ratings[0]).toMatchObject({ score: 8, updatedAt: T2 });
  });

  it('a future-dated guest row cannot beat a newer account change', async () => {
    await applyLibraryCommand(db, userId, setStatus(movie, 'watched'), T2);
    await merge(state({ items: [item(movie, { status: 'want', updatedAt: FUTURE })] }), T1);
    expect((await loadLibrary(db, userId)).items[0]).toMatchObject({ status: 'watched', updatedAt: T2 });
  });

  it('keeps a newer row another device wrote after the load (guarded upsert), answering what was kept', async () => {
    const racing = Object.assign(Object.create(db) as object, {
      transaction: async (fn: Parameters<typeof db.transaction>[0]) => {
        await applyLibraryCommand(db, userId, setStatus(movie, 'want'), T2);
        return db.transaction(fn);
      },
    }) as typeof db;
    const guest = state({ items: [item(movie, { status: 'watched', updatedAt: T1, watchedAt: T1 })] });
    const answer = await mergeGuestLibrary(racing, userId, guest, T3);
    expect(answer.items).toMatchObject([{ status: 'want', updatedAt: T2 }]);
    expect((await loadLibrary(db, userId)).items).toMatchObject([{ status: 'want', updatedAt: T2 }]);
  });

  it("never touches another user's rows", async () => {
    const other = `${userId}-other`;
    await db.insert(users).values({ id: other });
    await applyLibraryCommand(db, other, setStatus(movie, 'want'), T0);
    await merge(state({ items: [item(movie, { status: 'watched', updatedAt: T1, watchedAt: T1 })] }));
    expect((await loadLibrary(db, other)).items).toMatchObject([{ status: 'want', updatedAt: T0 }]);
  });

  it('413 (LibraryLimitError) when the merge would pass a per-user limit, writing nothing', async () => {
    const rows = Array.from({ length: 4_999 }, (_, i) => ({
      userId,
      mediaType: 'movie',
      tmdbId: 100_000 + i,
      status: 'want',
      title: 'Filme',
      addedAt: T0,
      updatedAt: T0,
    }));
    for (let i = 0; i < rows.length; i += 1000) await db.insert(libraryItems).values(rows.slice(i, i + 1000));
    const guest = state({ items: [item(movie), item(tv)], episodes: [mark(1, T1)] });
    await expect(merge(guest)).rejects.toBeInstanceOf(LibraryLimitError);
    expect(await countRows(libraryItems)).toBe(4_999);
    expect(await countRows(episodeProgress)).toBe(0);
    // One more title still fits.
    await merge(state({ items: [item(movie)] }));
    expect(await countRows(libraryItems)).toBe(5_000);
  });
});
