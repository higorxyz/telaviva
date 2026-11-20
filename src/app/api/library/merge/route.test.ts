// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodeProgress, libraryItems, ratings, users } from '@/server/db/schema';
import { loadLibrary } from '@/server/library/store';
import { adminAuthMock, decodedToken, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';
import { createTestDb } from '@/test/db';

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/server/db/client', () => ({ getDb: () => holder.db }));
vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { POST } from './route';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
  await db.insert(users).values({ id: 'user-1' });
});

beforeEach(async () => {
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
  adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken());
  holder.db = db;
  await db.delete(libraryItems);
  await db.delete(ratings);
  await db.delete(episodeProgress);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const LOCAL = 'http://localhost:3000';
const T0 = '2026-11-01T10:00:00.000Z';
const T1 = '2026-11-01T11:00:00.000Z';
const snapshot = { title: 'Clube da Luta', posterPath: null, releaseDate: '1999-10-15', genreIds: [18] };
const movie = { mediaType: 'movie', tmdbId: 550 } as const;
const series = { mediaType: 'tv', tmdbId: 1398 } as const;
const guest = {
  version: 1,
  items: [
    { ...movie, status: 'watched', addedAt: T0, updatedAt: T1, watchedAt: T1, snapshot },
    { ...series, status: 'watching', addedAt: T0, updatedAt: T0, watchedAt: null, snapshot },
  ],
  episodes: [{ tvId: 1398, seasonNumber: 1, episodeNumber: 1, watchedAt: T0 }],
  ratings: [{ ...movie, score: 9, ratedAt: T1, updatedAt: T1 }],
};

const post = (body: string, headers: Record<string, string> = {}) =>
  POST(
    new Request(`${LOCAL}/api/library/merge`, {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: LOCAL,
        cookie: 'tv_session=abc; tv_auth=1',
        'content-type': 'application/json',
        ...headers,
      },
      body,
    }),
  );
const send = (library: unknown, headers?: Record<string, string>) => post(JSON.stringify({ library }), headers);

describe('POST /api/library/merge', () => {
  it('merges the guest library into the account and answers the stored state, never cached', async () => {
    await db.insert(libraryItems).values({ userId: 'user-1', ...movie, status: 'want', title: 'Clube', addedAt: T0, updatedAt: T0 });
    const res = await send(guest);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const state = await res.json();
    expect(state.items).toHaveLength(2);
    expect(state.items).toContainEqual(guest.items[0]);
    expect(state.episodes).toEqual(guest.episodes);
    expect(state.ratings).toEqual(guest.ratings);
    expect(await loadLibrary(db, 'user-1')).toEqual(state);
  });

  it('merging twice never duplicates and the second call writes nothing', async () => {
    const first = await (await send(guest)).json();
    const transaction = vi.spyOn(db, 'transaction');
    const res = await send(guest);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(first);
    expect(transaction).not.toHaveBeenCalled();
    const stored = await loadLibrary(db, 'user-1');
    expect([stored.items.length, stored.episodes.length, stored.ratings.length]).toEqual([2, 1, 1]);
  });

  it('drops unreadable guest rows instead of refusing the whole library', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const library = {
      ...guest,
      items: [...guest.items, { ...movie, tmdbId: 7, status: 'watching', addedAt: T0, updatedAt: T0, watchedAt: null, snapshot }],
      episodes: [...guest.episodes, { tvId: -1 }],
    };
    const res = await send(library);
    expect(res.status).toBe(200);
    const state = await res.json();
    expect(state.items).toHaveLength(2);
    expect(state.episodes).toHaveLength(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Clube');
  });

  it('trims an oversized guest snapshot instead of dropping its row', async () => {
    const long = { ...snapshot, title: 'T'.repeat(400) };
    const res = await send({ ...guest, items: [{ ...guest.items[0], snapshot: long }], episodes: [], ratings: [] });
    expect(res.status).toBe(200);
    expect((await res.json()).items[0].snapshot.title).toBe('T'.repeat(300));
  });

  it('never stores a guest timestamp later than the server clock', async () => {
    const future = '2999-01-01T00:00:00.000Z';
    const res = await send({ ...guest, items: [{ ...guest.items[0], updatedAt: future, watchedAt: future }] });
    const state = await res.json();
    expect(Date.parse(state.items[0].updatedAt)).toBeLessThanOrEqual(Date.now());
    expect(Date.parse(state.items[0].watchedAt)).toBeLessThanOrEqual(Date.now());
  });

  it('401 without a valid session, writing nothing', async () => {
    adminAuthMock.verifySessionCookie.mockRejectedValue(new Error('expired'));
    const res = await send(guest);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
    expect((await loadLibrary(db, 'user-1')).items).toEqual([]);
  });

  it('403 for another Origin, writing nothing', async () => {
    const res = await send(guest, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect((await loadLibrary(db, 'user-1')).items).toEqual([]);
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    expect((await send(guest)).status).toBe(404);
  });

  it.each([
    ['invalid JSON', 'not json'],
    ['no library', '{}'],
    ['an array body', '[]'],
    ['a library that is not an object', JSON.stringify({ library: 'tudo' })],
    ['a library that is an array', JSON.stringify({ library: [] })],
    ['a library of another version', JSON.stringify({ library: { ...guest, version: 2 } })],
    ['a library without its lists', JSON.stringify({ library: { version: 1 } })],
  ])('400 { error: invalid } for %s', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid' });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('413 for a body over 2 MB, writing nothing', async () => {
    const big = { ...guest, items: [{ ...guest.items[0], snapshot: { ...snapshot, title: 'x'.repeat(2 * 1024 * 1024) } }] };
    const res = await send(big);
    expect(res.status).toBe(413);
    expect((await loadLibrary(db, 'user-1')).items).toEqual([]);
  });

  it('accepts a body just under 2 MB (a large guest library is not refused)', async () => {
    const pad = 'x'.repeat(2 * 1024 * 1024 - JSON.stringify({ library: guest, pad: '' }).length - 16);
    const res = await post(JSON.stringify({ library: guest, pad }));
    expect(res.status).toBe(200);
  });

  it('413 { error: limit } past the per-user limit, writing nothing', async () => {
    const rows = Array.from({ length: 5_000 }, (_, i) => ({
      userId: 'user-1',
      mediaType: 'tv',
      tmdbId: 100_000 + i,
      status: 'want',
      title: 'Série',
    }));
    for (let i = 0; i < rows.length; i += 1000) await db.insert(libraryItems).values(rows.slice(i, i + 1000));
    const res = await send(guest);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'limit' });
    const stored = await loadLibrary(db, 'user-1');
    expect([stored.items.length, stored.episodes.length, stored.ratings.length]).toEqual([5_000, 0, 0]);
  });

  it('500 { error: server_error } on a database failure, logging no user data', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    holder.db = {
      execute: () => {
        throw new Error('db down for user-1 / Clube da Luta');
      },
    };
    const res = await send(guest);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server_error' });
    const printed = JSON.stringify(log.mock.calls);
    expect(log).toHaveBeenCalled();
    expect(printed).not.toContain('user-1');
    expect(printed).not.toContain('Clube');
    expect(printed).not.toContain('abc');
  });
});
