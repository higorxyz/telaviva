// @vitest-environment node
import { count, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { libraryItems, users } from '@/server/db/schema';
import { adminAuthMock, decodedToken, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';
import { createTestDb } from '@/test/db';

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/server/db/client', () => ({ getDb: () => holder.db }));
vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { DELETE } from './route';

const LOCAL = 'http://localhost:3000';
const now = () => Math.floor(Date.now() / 1000);

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(async () => {
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
  holder.db = db;
  await db.delete(users);
  await db.insert(users).values([{ id: 'user-1' }, { id: 'user-2' }]);
  await db.insert(libraryItems).values([
    { userId: 'user-1', mediaType: 'movie', tmdbId: 550, status: 'want', title: 'Clube da Luta' },
    { userId: 'user-2', mediaType: 'movie', tmdbId: 13, status: 'watched', title: 'Forrest Gump' },
  ]);
  // Signed in a minute ago: recent enough to delete.
  adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken({ auth_time: now() - 60 }));
  adminAuthMock.deleteUser.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const del = (headers: Record<string, string> = {}) =>
  DELETE(
    new Request(`${LOCAL}/api/account`, {
      method: 'DELETE',
      headers: { host: 'localhost:3000', origin: LOCAL, cookie: 'tv_session=abc; tv_auth=1', ...headers },
    }),
  );

const rowsOf = async (userId: string) =>
  (await db.select({ n: count() }).from(users).where(eq(users.id, userId)))[0].n +
  (await db.select({ n: count() }).from(libraryItems).where(eq(libraryItems.userId, userId)))[0].n;

describe('DELETE /api/account', () => {
  it('204: deletes the data and the Firebase user, clears both cookies, checking revocation', async () => {
    const res = await del();
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const cookies = res.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    expect(cookies.find((c) => c.startsWith('tv_session='))).toMatch(/Max-Age=0/);
    expect(cookies.find((c) => c.startsWith('tv_auth='))).toMatch(/Max-Age=0/);
    expect(adminAuthMock.verifySessionCookie).toHaveBeenCalledWith('abc', true);
    expect(adminAuthMock.deleteUser).toHaveBeenCalledWith('user-1');
    expect(await rowsOf('user-1')).toBe(0);
    expect(await rowsOf('user-2')).toBe(2);
  });

  it('401 { error: reauth } when the sign-in behind the session is older than 5 minutes', async () => {
    adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken({ auth_time: now() - 6 * 60, iat: now() - 10 }));
    const res = await del();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'reauth' });
    expect(adminAuthMock.deleteUser).not.toHaveBeenCalled();
    expect(await rowsOf('user-1')).toBe(2);
  });

  it('401 { error: unauthenticated } without a valid (or with a revoked) session', async () => {
    adminAuthMock.verifySessionCookie.mockRejectedValue(Object.assign(new Error('revoked'), { code: 'auth/session-cookie-revoked' }));
    const res = await del();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
    expect(await rowsOf('user-1')).toBe(2);
  });

  it('403 for a cross-site Origin, before reading the session', async () => {
    const res = await del({ origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(adminAuthMock.verifySessionCookie).not.toHaveBeenCalled();
    expect(await rowsOf('user-1')).toBe(2);
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('DATABASE_DRIVER', '');
    expect((await del()).status).toBe(404);
    expect(await rowsOf('user-1')).toBe(2);
  });

  it('502 when Firebase fails after the data is gone, logging no user data; a retry answers 204', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    adminAuthMock.deleteUser.mockRejectedValueOnce(
      Object.assign(new Error('internal for user-1 ana@example.com'), { code: 'auth/internal-error' }),
    );
    const res = await del();
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'server_error' });
    expect(res.headers.getSetCookie()).toEqual([]);
    expect(await rowsOf('user-1')).toBe(0);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/user-1|ana@example/);

    const retry = await del();
    expect(retry.status).toBe(204);
    expect(adminAuthMock.deleteUser).toHaveBeenCalledTimes(2);
  });

  it('500 on a database failure, without touching Firebase', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    holder.db = { transaction: () => Promise.reject(new Error('db down')) };
    const res = await del();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server_error' });
    expect(adminAuthMock.deleteUser).not.toHaveBeenCalled();
  });
});
