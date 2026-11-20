// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAppModule, adminAuthMock, decodedToken, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';
import { createTestDb } from '@/test/db';
import { users } from '@/server/db/schema';

vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { createSession, isRecentSignIn, readSession, SessionError, SESSION_DURATION_MS } from './session';

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

  it('refuses a token whose sign-in and minting are both older than 5 minutes (plus skew), writing nothing', async () => {
    const now = Math.floor(Date.now() / 1000);
    adminAuthMock.verifyIdToken.mockResolvedValue(
      decodedToken({ uid: 'user-3', sub: 'user-3', auth_time: now - 3600, iat: now - 5 * 60 - 61 }),
    );
    const error = await createSession('stale', { db }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SessionError);
    expect((error as SessionError).code).toBe('stale_login');
    expect(adminAuthMock.createSessionCookie).not.toHaveBeenCalled();
    expect(await rowFor('user-3')).toBeUndefined();
  });

  it('accepts an old sign-in when the ID token was just minted (silent renewal)', async () => {
    const now = Math.floor(Date.now() / 1000);
    adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken({ auth_time: now - 3 * 24 * 3600, iat: now - 5 }));
    const { user } = await createSession('renewed', { db });
    expect(adminAuthMock.verifyIdToken).toHaveBeenCalledWith('renewed', true);
    expect(adminAuthMock.createSessionCookie).toHaveBeenCalled();
    // The session keeps the original sign-in time: a renewal never counts as a recent sign-in.
    expect(user.authTime).toBe(now - 3 * 24 * 3600);
    expect(isRecentSignIn(user.authTime)).toBe(false);
  });

  it('allows 60 s of clock skew on the token age', async () => {
    const now = Math.floor(Date.now() / 1000);
    adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken({ auth_time: now - 3600, iat: now - 5 * 60 - 50 }));
    await expect(createSession('skewed', { db })).resolves.toMatchObject({ cookie: 'session-cookie-value' });
  });

  it('refuses an old ID token even when the sign-in itself was recent enough before', async () => {
    const now = Math.floor(Date.now() / 1000);
    adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken({ auth_time: now - 400, iat: now - 400 }));
    await expect(createSession('old', { db })).rejects.toMatchObject({ code: 'stale_login' });
  });

  it('isRecentSignIn: at most 5 minutes since the real sign-in (for account deletion)', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(isRecentSignIn(now - 300, now)).toBe(true);
    expect(isRecentSignIn(now - 301, now)).toBe(false);
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

  it('is null for an invalid, expired or revoked cookie, without logging', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    adminAuthMock.verifySessionCookie.mockRejectedValue(
      Object.assign(new Error('expired cookie-value'), { code: 'auth/session-cookie-expired' }),
    );
    expect(await readSession('cookie-value', { checkRevoked: true })).toBeNull();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('logs why firebase-admin could not start (a setup error), never the cookie, and is null', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    adminAppModule.cert.mockImplementationOnce(() => {
      throw Object.assign(new Error('Failed to parse private key.'), { code: 'app/invalid-credential' });
    });
    expect(await readSession('cookie-value')).toBeNull();
    const printed = JSON.stringify(log.mock.calls);
    expect(printed).toContain('FIREBASE_PRIVATE_KEY');
    expect(printed).not.toContain('cookie-value');
    log.mockRestore();
  });

  it('is null when sign-in is turned off', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    expect(await readSession('cookie')).toBeNull();
    expect(adminAuthMock.verifySessionCookie).not.toHaveBeenCalled();
  });
});
