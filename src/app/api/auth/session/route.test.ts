// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { users } from '@/server/db/schema';
import { adminAppModule, adminAuthError, adminAuthMock, decodedToken, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';
import { createTestDb } from '@/test/db';

const holder = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/server/db/client', () => ({ getDb: () => holder.db }));
vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { DELETE, POST } from './route';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  holder.db = db;
});

beforeEach(() => {
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
  adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken());
  adminAuthMock.createSessionCookie.mockResolvedValue('header.payload.signature');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

const LOCAL = 'http://localhost:3000';
const post = (body: string, headers: Record<string, string> = {}) =>
  POST(
    new Request(`${LOCAL}/api/auth/session`, {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        origin: LOCAL,
        'content-type': 'application/json',
        ...headers,
      },
      body,
    }),
  );
const del = (headers: Record<string, string> = {}) =>
  DELETE(
    new Request(`${LOCAL}/api/auth/session`, {
      method: 'DELETE',
      headers: { host: 'localhost:3000', origin: LOCAL, ...headers },
    }),
  );
const token = JSON.stringify({ idToken: 'id-token' });

describe('POST /api/auth/session', () => {
  it('sets tv_session (HttpOnly) and tv_auth with the exact flags, returns the user and saves it', async () => {
    const res = await post(token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: expect.objectContaining({
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana',
        emailVerified: true,
      }),
    });
    expect(res.headers.getSetCookie()).toEqual([
      'tv_session=header.payload.signature; Path=/; Max-Age=1209600; HttpOnly; SameSite=Lax',
      'tv_auth=1; Path=/; Max-Age=1209600; SameSite=Lax',
    ]);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const [row] = await db.select().from(users).where(eq(users.id, 'user-1'));
    expect(row).toMatchObject({ email: 'ana@example.com', name: 'Ana' });
  });

  it('adds Secure on https (Vercel)', async () => {
    const res = await post(token, {
      host: '10.0.0.1',
      'x-forwarded-host': 'telaviva.vercel.app',
      'x-forwarded-proto': 'https',
      origin: 'https://telaviva.vercel.app',
    });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toEqual([
      'tv_session=header.payload.signature; Path=/; Max-Age=1209600; HttpOnly; SameSite=Lax; Secure',
      'tv_auth=1; Path=/; Max-Age=1209600; SameSite=Lax; Secure',
    ]);
  });

  it('401 for an invalid token, without cookies', async () => {
    adminAuthMock.verifyIdToken.mockRejectedValue(adminAuthError('auth/argument-error', 'bad token'));
    const res = await post(token);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_token' });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('503 { error: unavailable } when Firebase cannot be reached to check the token, without cookies', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    adminAuthMock.verifyIdToken.mockRejectedValue(adminAuthError('app/network-error'));
    const res = await post(token);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable' });
    expect(res.headers.getSetCookie()).toEqual([]);
    log.mockRestore();
  });

  it('401 for a token whose sign-in and minting are both older than 5 minutes', async () => {
    const now = Math.floor(Date.now() / 1000);
    adminAuthMock.verifyIdToken.mockResolvedValue(decodedToken({ auth_time: now - 3600, iat: now - 361 }));
    const res = await post(token);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'stale_login' });
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('403 for another Origin or none, before touching the token', async () => {
    for (const headers of [{ origin: 'https://evil.example' }, { origin: '' }]) {
      const res = await post(token, headers);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'forbidden' });
    }
    expect(adminAuthMock.verifyIdToken).not.toHaveBeenCalled();
  });

  it('413 for a body over 64 KB', async () => {
    const res = await post(JSON.stringify({ idToken: 'x'.repeat(64 * 1024) }));
    expect(res.status).toBe(413);
    expect(adminAuthMock.verifyIdToken).not.toHaveBeenCalled();
  });

  it.each(['not json', '{}', '{"idToken":""}', '{"idToken":42}', '[]', 'null'])(
    '400 for %s',
    async (body) => {
      expect((await post(body)).status).toBe(400);
      expect(adminAuthMock.verifyIdToken).not.toHaveBeenCalled();
    },
  );

  it('500 without leaking details when the database write fails', async () => {
    holder.db = {
      insert: () => {
        throw new Error('db down: secret detail');
      },
    };
    try {
      const res = await post(token);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'server_error' });
      expect(res.headers.getSetCookie()).toEqual([]);
    } finally {
      holder.db = db;
    }
  });

  it('never logs the token or the cookie', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    adminAuthMock.createSessionCookie.mockRejectedValue(new Error('quota id-token header.payload'));
    await post(token);
    const printed = JSON.stringify(log.mock.calls);
    expect(printed).not.toContain('id-token');
    expect(printed).not.toContain('header.payload');
  });

  it('logs a setup failure with its message (the app’s own text), still without the token', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    adminAppModule.cert.mockImplementationOnce(() => {
      throw Object.assign(new Error('Failed to parse private key.'), { code: 'app/invalid-credential' });
    });
    const res = await post(token);
    expect(res.status).toBe(500);
    const printed = JSON.stringify(log.mock.calls);
    expect(printed).toContain('Credencial do Firebase inválida');
    expect(printed).not.toContain('id-token');
  });

  it('429 after 30 requests a minute from one IP', async () => {
    const fromIp = () => post('{}', { 'x-forwarded-for': '192.0.2.77' });
    for (let i = 0; i < 30; i++) expect((await fromIp()).status).toBe(400);
    const blocked = await fromIp();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    expect((await post(token)).status).toBe(404);
    expect(adminAuthMock.verifyIdToken).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/auth/session', () => {
  const cleared = [
    'tv_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    'tv_auth=; Path=/; Max-Age=0; SameSite=Lax',
  ];

  it('signs out this device only: clears both cookies and answers 204, revoking nothing', async () => {
    adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken());
    const res = await del({ cookie: 'tv_session=abc; tv_auth=1' });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toEqual(cleared);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    // Revoking would sign every other device out too (a new sign-in everywhere): only account deletion ends them.
    expect(adminAuthMock.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('clears the cookies whatever the session, without asking Firebase', async () => {
    const cases: Record<string, string>[] = [{}, { cookie: 'tv_session=expired' }];
    for (const headers of cases) {
      const res = await del(headers);
      expect(res.status).toBe(204);
      expect(res.headers.getSetCookie()).toEqual(cleared);
    }
    expect(adminAuthMock.verifySessionCookie).not.toHaveBeenCalled();
    expect(adminAuthMock.revokeRefreshTokens).not.toHaveBeenCalled();
  });

  it('403 for another Origin, leaving the cookies alone', async () => {
    const res = await del({ cookie: 'tv_session=abc', origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('DATABASE_DRIVER', '');
    expect((await del()).status).toBe(404);
  });
});
