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

const T0 = '2026-11-20T10:00:00.000Z';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
  await db.insert(users).values([
    { id: 'user-1', email: 'ana@example.com', name: 'Ana', createdAt: T0 },
    { id: 'user-2', email: 'bia@example.com', name: 'Bia', createdAt: T0 },
  ]);
  await db.insert(libraryItems).values([
    { userId: 'user-1', mediaType: 'movie', tmdbId: 550, status: 'want', title: 'Clube da Luta', addedAt: T0, updatedAt: T0 },
    { userId: 'user-2', mediaType: 'movie', tmdbId: 13, status: 'watched', title: 'Forrest Gump' },
  ]);
});

beforeEach(() => {
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
  holder.db = db;
  adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken());
  vi.useFakeTimers({ toFake: ['Date'] });
  // 01:30 UTC on the 21st: still the 20th in São Paulo.
  vi.setSystemTime(new Date('2026-11-21T01:30:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// A plain download link: no Origin, as a GET needs none.
const get = (headers: Record<string, string> = { cookie: 'tv_session=abc; tv_auth=1' }) =>
  GET(new Request('http://localhost:3000/api/account/export', { headers: { host: 'localhost:3000', ...headers } }));

describe('GET /api/account/export', () => {
  it("200: the user's own data as a dated JSON attachment, never cached, checking revocation", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="telaviva-meus-dados-2026-11-20.json"',
    );
    expect(res.headers.get('cache-control')).toMatch(/no-store/);
    expect(adminAuthMock.verifySessionCookie).toHaveBeenCalledWith('abc', true);

    const body = await res.json();
    expect(body.exportedAt).toBe('2026-11-21T01:30:00.000Z');
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'ana@example.com',
      name: 'Ana',
      photoUrl: null,
      createdAt: T0,
    });
    expect(body.library.items.map((i: { tmdbId: number }) => i.tmdbId)).toEqual([550]);
    expect(JSON.stringify(body)).not.toMatch(/user-2|Forrest|bia@/);
  });

  it('401 without a session', async () => {
    const res = await get({});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
  });

  it('401 for a revoked session', async () => {
    adminAuthMock.verifySessionCookie.mockRejectedValue(new Error('revoked'));
    expect((await get()).status).toBe(401);
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('DATABASE_DRIVER', '');
    expect((await get()).status).toBe(404);
  });

  it('500 on a database failure, logging no user data', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    holder.db = {
      select: () => {
        throw new Error('db down for user-1');
      },
      execute: () => {
        throw new Error('db down for user-1');
      },
    };
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server_error' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('user-1');
  });
});
