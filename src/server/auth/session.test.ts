// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAuthMock, decodedToken, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';
import { createTestDb } from '@/test/db';
import { users } from '@/server/db/schema';

vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { createSession, readSession, SessionError, SESSION_DURATION_MS } from './session';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(() => {
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
  adminAuthMock.createSessionCookie.mockResolvedValue('session-cookie-value');
});
afterEach(() => vi.unstubAllEnvs());

const rowFor = async (id: string) => (await db.select().from(users).where(eq(users.id, id)))[0];

describe('createSession', () => {
  it('verifies the token (checking revocation), mints a 14-day cookie and upserts the user', async () => {
    adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken());
    const { cookie, user } = await createSession('id-token', { db });

    expect(SESSION_DURATION_MS).toBe(14 * 24 * 60 * 60 * 1000);
    expect(adminAuthMock.verifyIdToken).toHaveBeenCalledWith('id-token', true);
    expect(adminAuthMock.createSessionCookie).toHaveBeenCalledWith('id-token', {
      expiresIn: 1_209_600_000,
    });
    expect(cookie).toBe('session-cookie-value');
    expect(user).toEqual({
      id: 'user-1',
      email: 'ana@example.com',
      name: 'Ana',
      photoUrl: 'https://example.com/ana.png',
      emailVerified: true,
      authTime: expect.any(Number),
    });
    expect(await rowFor('user-1')).toMatchObject({
      email: 'ana@example.com',
      name: 'Ana',
      photoUrl: 'https://example.com/ana.png',
    });
  });

  it('updates email, name, photo and updated_at on a later sign-in, keeping created_at', async () => {
    adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken({ uid: 'user-4', sub: 'user-4' }));
    await createSession('first', { db });
    const before = await rowFor('user-4');
    await new Promise((r) => setTimeout(r, 5));

    adminAuthMock.verifyIdToken.mockResolvedValue(
      decodedToken({
        uid: 'user-4',
        sub: 'user-4',
        email: 'new@example.com',
        name: 'Ana Maria',
        picture: 'https://example.com/new.png',
      }),
    );
    await createSession('second', { db });
    const after = await rowFor('user-4');

    expect(after).toMatchObject({
      email: 'new@example.com',
      name: 'Ana Maria',
      photoUrl: 'https://example.com/new.png',
      createdAt: before.createdAt,
    });
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
  });

  it('keeps the stored name and photo when a later token has no name or picture claim', async () => {
    adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken({ uid: 'user-2', sub: 'user-2' }));
    await createSession('first', { db });
    const before = await rowFor('user-2');
    await new Promise((r) => setTimeout(r, 5));

    adminAuthMock.verifyIdToken.mockResolvedValue(
      decodedToken({
        uid: 'user-2',
        sub: 'user-2',
        email: 'new@example.com',
        name: undefined,
        picture: undefined,
      }),
    );
    const { user } = await createSession('second', { db });
    const after = await rowFor('user-2');

    // The session reports what the token says; the database keeps what it knew.
    expect(user).toMatchObject({ email: 'new@example.com', name: null, photoUrl: null });
    expect(after).toMatchObject({
      email: 'new@example.com',
      name: 'Ana',
      photoUrl: 'https://example.com/ana.png',
      createdAt: before.createdAt,
    });
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
  });

  it('refuses a sign-in older than 5 minutes without minting a cookie or writing the user', async () => {
    const stale = Math.floor(Date.now() / 1000) - 5 * 60 - 1;
    adminAuthMock.verifyIdToken.mockResolvedValue(
      decodedToken({ uid: 'user-3', sub: 'user-3', auth_time: stale }),
    );
    const error = await createSession('stale', { db }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).code).toBe('stale_login');
    expect(adminAuthMock.createSessionCookie).not.toHaveBeenCalled();
    expect(await rowFor('user-3')).toBeUndefined();
  });

  it('turns a rejected token into SessionError("invalid_token")', async () => {
    adminAuthMock.verifyIdToken.mockRejectedValue(
      Object.assign(new Error('bad'), { code: 'auth/argument-error' }),
    );
    const error = await createSession('garbage', { db }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).code).toBe('invalid_token');
    expect(adminAuthMock.createSessionCookie).not.toHaveBeenCalled();
  });

  it('lets a database failure surface as itself (a 500, not a 401)', async () => {
    adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken());
    const broken = {
      insert: () => {
        throw new Error('db down');
      },
    } as unknown as typeof db;
    await expect(createSession('id-token', { db: broken })).rejects.toThrow('db down');
  });
});

describe('readSession', () => {
  it('is null without a cookie, without asking firebase-admin', async () => {
    expect(await readSession(undefined)).toBeNull();
    expect(await readSession('')).toBeNull();
    expect(adminAuthMock.verifySessionCookie).not.toHaveBeenCalled();
  });

  it('maps a valid cookie to a SessionUser', async () => {
    adminAuthMock.verifySessionCookie.mockResolvedValue(
      decodedToken({ auth_time: 1_700_000_000, email_verified: false }),
    );
    expect(await readSession('cookie')).toEqual({
      id: 'user-1',
      email: 'ana@example.com',
      name: 'Ana',
      photoUrl: 'https://example.com/ana.png',
      emailVerified: false,
      authTime: 1_700_000_000,
    });
    expect(adminAuthMock.verifySessionCookie).toHaveBeenCalledWith('cookie', false);
  });

  it('passes checkRevoked through', async () => {
    adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken());
    await readSession('cookie', { checkRevoked: true });
    expect(adminAuthMock.verifySessionCookie).toHaveBeenCalledWith('cookie', true);
  });

  it('is null for an invalid, expired or revoked cookie', async () => {
    adminAuthMock.verifySessionCookie.mockRejectedValue(new Error('expired'));
    expect(await readSession('cookie', { checkRevoked: true })).toBeNull();
  });

  it('is null when sign-in is turned off', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    expect(await readSession('cookie')).toBeNull();
    expect(adminAuthMock.verifySessionCookie).not.toHaveBeenCalled();
  });
});
