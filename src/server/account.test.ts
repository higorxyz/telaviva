// @vitest-environment node
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { appliedCommands, episodeProgress, libraryItems, libraryRemovals, ratings, users } from '@/server/db/schema';
import { createTestDb } from '@/test/db';
import { AccountAuthError, deleteAccount, exportAccount, exportFilename } from './account';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.$client.close();
});

const T0 = '2026-11-20T10:00:00.000Z';
const firebaseError = (code: string) => Object.assign(new Error(`${code} for user-1`), { code });

async function seed(userId: string, tmdbId: number) {
  await db.insert(users).values({ id: userId, email: `${userId}@exemplo.com`, name: 'Ana', createdAt: T0 });
  await db.insert(libraryItems).values({
    userId,
    mediaType: 'movie',
    tmdbId,
    status: 'watched',
    title: `Filme ${tmdbId}`,
    addedAt: T0,
    updatedAt: T0,
    watchedAt: T0,
  });
  await db.insert(episodeProgress).values({ userId, tvId: 1398, seasonNumber: 1, episodeNumber: 1, watchedAt: T0 });
  await db.insert(ratings).values({ userId, mediaType: 'movie', tmdbId, score: 9, ratedAt: T0, updatedAt: T0 });
}

async function rowsOf(userId: string) {
  const [u] = await db.select({ n: count() }).from(users).where(eq(users.id, userId));
  const [i] = await db.select({ n: count() }).from(libraryItems).where(eq(libraryItems.userId, userId));
  const [e] = await db.select({ n: count() }).from(episodeProgress).where(eq(episodeProgress.userId, userId));
  const [r] = await db.select({ n: count() }).from(ratings).where(eq(ratings.userId, userId));
  return u.n + i.n + e.n + r.n;
}

beforeEach(async () => {
  await db.delete(users);
  await seed('user-1', 550);
  await seed('user-2', 13);
});

describe('deleteAccount', () => {
  it("deletes the user's rows first, then the Firebase user, and leaves other users alone", async () => {
    const adminAuth = {
      deleteUser: vi.fn(async () => {
        // The database is already empty for this user when Firebase is asked.
        expect(await rowsOf('user-1')).toBe(0);
      }),
    };
    await deleteAccount(db, adminAuth, 'user-1');
    expect(adminAuth.deleteUser).toHaveBeenCalledWith('user-1');
    expect(await rowsOf('user-1')).toBe(0);
    expect(await rowsOf('user-2')).toBe(4);
  });

  it('counts a Firebase user that is already gone as deleted', async () => {
    const adminAuth = { deleteUser: vi.fn().mockRejectedValue(firebaseError('auth/user-not-found')) };
    await expect(deleteAccount(db, adminAuth, 'user-1')).resolves.toBeUndefined();
    expect(await rowsOf('user-1')).toBe(0);
  });

  it('throws AccountAuthError when Firebase fails after the database, and a retry completes', async () => {
    const adminAuth = { deleteUser: vi.fn().mockRejectedValueOnce(firebaseError('auth/internal-error')) };
    await expect(deleteAccount(db, adminAuth, 'user-1')).rejects.toBeInstanceOf(AccountAuthError);
    // No data outlives the failure: only the Firebase user is left, and repeating is safe.
    expect(await rowsOf('user-1')).toBe(0);
    adminAuth.deleteUser.mockResolvedValueOnce(undefined);
    await expect(deleteAccount(db, adminAuth, 'user-1')).resolves.toBeUndefined();
    expect(adminAuth.deleteUser).toHaveBeenCalledTimes(2);
    expect(await rowsOf('user-2')).toBe(4);
  });

  it('never asks Firebase when the database step fails, so the account and its data stay together', async () => {
    const adminAuth = { deleteUser: vi.fn() };
    const broken = {
      transaction: () => Promise.reject(new Error('db down')),
    } as unknown as typeof db;
    await expect(deleteAccount(broken, adminAuth, 'user-1')).rejects.toThrow('db down');
    expect(adminAuth.deleteUser).not.toHaveBeenCalled();
    expect(await rowsOf('user-1')).toBe(4);
  });
});

describe('exportAccount', () => {
  const session = { id: 'user-1', email: 'outro@exemplo.com', name: null, photoUrl: null };

  it("holds exactly the user's stored profile and library, never another user's", async () => {
    const data = await exportAccount(db, session, new Date('2026-11-20T15:00:00.000Z'));
    expect(data).toEqual({
      exportedAt: '2026-11-20T15:00:00.000Z',
      user: { id: 'user-1', email: 'user-1@exemplo.com', name: 'Ana', photoUrl: null, createdAt: T0 },
      library: {
        version: 1,
        items: [
          {
            mediaType: 'movie',
            tmdbId: 550,
            status: 'watched',
            addedAt: T0,
            updatedAt: T0,
            watchedAt: T0,
            snapshot: { title: 'Filme 550', posterPath: null, releaseDate: null, genreIds: [] },
          },
        ],
        episodes: [{ tvId: 1398, seasonNumber: 1, episodeNumber: 1, watchedAt: T0 }],
        ratings: [{ mediaType: 'movie', tmdbId: 550, score: 9, ratedAt: T0, updatedAt: T0 }],
      },
    });
    expect(JSON.stringify(data)).not.toContain('user-2');
  });

  it('falls back to the session profile, with an empty library, when the user has no row', async () => {
    const data = await exportAccount(db, { ...session, id: 'nobody' }, new Date(T0));
    expect(data).toEqual({
      exportedAt: T0,
      user: { id: 'nobody', email: 'outro@exemplo.com', name: null, photoUrl: null, createdAt: null },
      library: { version: 1, items: [], episodes: [], ratings: [] },
    });
  });
});

describe('removal markers and applied commands (offline queue)', () => {
  const session = { id: 'user-1', email: null, name: null, photoUrl: null };

  async function seedOffline(userId: string) {
    await db.insert(libraryRemovals).values([
      { userId, kind: 'item', mediaType: 'movie', tmdbId: 77, removedAt: T0 },
      { userId, kind: 'mark', mediaType: 'tv', tmdbId: 1398, seasonNumber: 1, episodeNumber: 2, removedAt: T0 },
    ]);
    await db.insert(appliedCommands).values({ userId, commandId: `${userId}-cmd`, appliedAt: T0 });
  }

  async function offlineRowsOf(userId: string) {
    const [m] = await db.select({ n: count() }).from(libraryRemovals).where(eq(libraryRemovals.userId, userId));
    const [a] = await db.select({ n: count() }).from(appliedCommands).where(eq(appliedCommands.userId, userId));
    return m.n + a.n;
  }

  it('never appear in the export', async () => {
    await seedOffline('user-1');
    const data = await exportAccount(db, session, new Date(T0));
    expect(Object.keys(data)).toEqual(['exportedAt', 'user', 'library']);
    expect(Object.keys(data.library).sort()).toEqual(['episodes', 'items', 'ratings', 'version']);
    expect(data.library.items.map((i) => i.tmdbId)).toEqual([550]);
    expect(data.library.episodes).toHaveLength(1);
    const text = JSON.stringify(data);
    expect(text).not.toContain('user-1-cmd');
    expect(text).not.toContain('removed');
    expect(text).not.toContain('"tmdbId":77');
  });

  it("go with the account when it is deleted, and another user's stay", async () => {
    await seedOffline('user-1');
    await seedOffline('user-2');
    await deleteAccount(db, { deleteUser: vi.fn() }, 'user-1');
    expect(await offlineRowsOf('user-1')).toBe(0);
    expect(await offlineRowsOf('user-2')).toBe(3);
  });
});

describe('exportFilename', () => {
  it('dates the file in the São Paulo calendar', () => {
    expect(exportFilename(new Date('2026-11-20T15:00:00.000Z'))).toBe('telaviva-meus-dados-2026-11-20.json');
    // 01:30 UTC on the 21st is still the evening of the 20th in São Paulo.
    expect(exportFilename(new Date('2026-11-21T01:30:00.000Z'))).toBe('telaviva-meus-dados-2026-11-20.json');
    expect(exportFilename(new Date('2026-01-05T12:00:00.000Z'))).toBe('telaviva-meus-dados-2026-01-05.json');
  });
});
