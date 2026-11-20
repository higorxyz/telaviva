// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { libraryItems, users } from '@/server/db/schema';
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
  await db.delete(libraryItems);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const LOCAL = 'http://localhost:3000';
const snapshot = { title: 'Clube da Luta', posterPath: null, releaseDate: '1999-10-15', genreIds: [18] };
const movie = { mediaType: 'movie', tmdbId: 550 } as const;
const setStatus = (status: string) => ({ type: 'setStatus', ref: movie, status, snapshot });

const post = (body: string, headers: Record<string, string> = {}) =>
  POST(
    new Request(`${LOCAL}/api/library/commands`, {
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
const send = (command: unknown, headers?: Record<string, string>) => post(JSON.stringify({ command }), headers);

describe('POST /api/library/commands', () => {
  it('applies the command for the signed-in user and answers the new state, never cached', async () => {
    const res = await send(setStatus('want'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const state = await res.json();
    expect(state).toMatchObject({ version: 1, items: [{ ...movie, status: 'want', snapshot }], episodes: [], ratings: [] });
    expect(await loadLibrary(db, 'user-1')).toEqual(state);
  });

  it('401 without a valid session, writing nothing', async () => {
    adminAuthMock.verifySessionCookie.mockRejectedValue(new Error('expired'));
    const res = await send(setStatus('want'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
    expect((await loadLibrary(db, 'user-1')).items).toEqual([]);
  });

  it('403 for another Origin', async () => {
    const res = await send(setStatus('want'), { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect((await loadLibrary(db, 'user-1')).items).toEqual([]);
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    expect((await send(setStatus('want'))).status).toBe(404);
  });

  it.each([
    ['invalid JSON', 'not json'],
    ['no command', '{}'],
    ['an unknown command', JSON.stringify({ command: { type: 'wipe' } })],
    ['watching for a movie', JSON.stringify({ command: setStatus('watching') })],
    ['an array', '[]'],
  ])('400 { error: invalid } for %s', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid' });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('413 for a body over 64 KB', async () => {
    const res = await send({ ...setStatus('want'), snapshot: { ...snapshot, title: 'x'.repeat(64 * 1024) } });
    expect(res.status).toBe(413);
    expect((await loadLibrary(db, 'user-1')).items).toEqual([]);
  });

  it('409 { error: conflict } when an undo finds the item changed since the action', async () => {
    const first = await (await send(setStatus('want'))).json();
    await send(setStatus('watched'));
    const res = await send({
      type: 'restore',
      ref: movie,
      item: first.items[0],
      rating: null,
      marks: [],
      expectedUpdatedAt: first.items[0].updatedAt,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'conflict' });
    expect((await loadLibrary(db, 'user-1')).items[0]).toMatchObject({ status: 'watched' });
  });

  it('413 { error: limit } past the per-user limit', async () => {
    const rows = Array.from({ length: 5_000 }, (_, i) => ({
      userId: 'user-1',
      mediaType: 'tv',
      tmdbId: 1 + i,
      status: 'want',
      title: 'Série',
    }));
    for (let i = 0; i < rows.length; i += 1000) await db.insert(libraryItems).values(rows.slice(i, i + 1000));
    const res = await send(setStatus('want'));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'limit' });
  });

  it('500 { error: server_error } on a database failure, logging no user data', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    holder.db = {
      execute: () => {
        throw new Error('db down for user-1 / Clube da Luta');
      },
    };
    try {
      const res = await send(setStatus('want'));
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'server_error' });
      const printed = JSON.stringify(log.mock.calls);
      expect(log).toHaveBeenCalled();
      expect(printed).not.toContain('user-1');
      expect(printed).not.toContain('Clube');
      expect(printed).not.toContain('abc');
    } finally {
      holder.db = db;
    }
  });
});
