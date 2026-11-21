// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { libraryItems, users } from '@/server/db/schema';
import { adminAuthMock, decodedToken, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';
import { createTestDb } from '@/test/db';

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/server/db/client', () => ({ getDb: () => holder.db }));
vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { GET } from './route';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
  await db.insert(users).values([{ id: 'user-1' }, { id: 'user-2' }]);
  await db.insert(libraryItems).values([
    {
      userId: 'user-1',
      mediaType: 'movie',
      tmdbId: 550,
      status: 'want',
      title: 'Clube da Luta',
      addedAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
    { userId: 'user-2', mediaType: 'movie', tmdbId: 13, status: 'watched', title: 'Forrest Gump' },
  ]);
});

beforeEach(() => {
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
  adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// GET carries no Origin: reads do not need it.
const SIGNED_IN = { cookie: 'tv_session=abc', 'x-expected-user': 'user-1' };
const get = (headers: Record<string, string> = SIGNED_IN) =>
  GET(new Request('http://localhost:3000/api/library', { headers: { host: 'localhost:3000', ...headers } }));

describe('GET /api/library', () => {
  it("200 with the signed-in user's library only, never cached", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      version: 1,
      items: [
        {
          mediaType: 'movie',
          tmdbId: 550,
          status: 'want',
          addedAt: '2026-11-20T10:00:00.000Z',
          updatedAt: '2026-11-20T10:00:00.000Z',
          watchedAt: null,
          snapshot: { title: 'Clube da Luta', posterPath: null, releaseDate: null, genreIds: [] },
        },
      ],
      episodes: [],
      ratings: [],
    });
  });

  it('401 unauthenticated for a session whose account is gone (deleted on another device)', async () => {
    adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken({ uid: 'deleted-user', sub: 'deleted-user' }));
    const res = await get({ cookie: 'tv_session=abc', 'x-expected-user': 'deleted-user' });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  it('reads the account and its library in one statement (one round trip to the database)', async () => {
    const statements: string[] = [];
    holder.db = {
      execute: (query: Parameters<typeof db.execute>[0]) => {
        statements.push('execute');
        return db.execute(query);
      },
    };
    try {
      const res = await get();
      expect(res.status).toBe(200);
      expect((await res.json()).items).toHaveLength(1);
      expect(statements).toEqual(['execute']);
    } finally {
      holder.db = db;
    }
  });

  it('409 wrong_account when X-Expected-User names someone else (another tab switched accounts)', async () => {
    const res = await get({ cookie: 'tv_session=abc', 'x-expected-user': 'user-2' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'wrong_account' });
  });

  it('400 without X-Expected-User', async () => {
    expect((await get({ cookie: 'tv_session=abc' })).status).toBe(400);
  });

  it('401 without a session', async () => {
    const res = await get({});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('DATABASE_DRIVER', '');
    expect((await get()).status).toBe(404);
  });

  it('500 { error: server_error } on a database failure, logging no user data', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Everything but the library statement works: the failure happens in the store, inside the route's own catch.
    holder.db = {
      select: db.select.bind(db),
      execute: () => {
        throw new Error('db down for user-1');
      },
    };
    try {
      const res = await get();
      expect(res.status).toBe(500);
      expect(JSON.stringify(log.mock.calls)).toContain('[api/library] could not load the library');
      expect(await res.json()).toEqual({ error: 'server_error' });
      expect(res.headers.get('cache-control')).toBe('private, no-store');
      expect(JSON.stringify(log.mock.calls)).not.toContain('user-1');
    } finally {
      holder.db = db;
    }
  });
});
