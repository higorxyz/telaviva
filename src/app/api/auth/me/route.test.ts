// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAuthMock, decodedToken, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';

vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { GET } from './route';

const get = (headers: Record<string, string> = {}) =>
  GET(
    new Request('http://localhost:3000/api/auth/me', {
      headers: { host: 'localhost:3000', ...headers },
    }),
  );

beforeEach(() => {
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/auth/me', () => {
  it('200 { user } for a valid session, never cached', async () => {
    adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken({ auth_time: 1_700_000_000 }));
    const res = await get({ cookie: 'tv_session=abc; tv_auth=1' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: {
        id: 'user-1',
        email: 'ana@example.com',
        name: 'Ana',
        photoUrl: 'https://example.com/ana.png',
        emailVerified: true,
        authTime: 1_700_000_000,
        provider: 'google',
      },
    });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('401 without a cookie', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthenticated' });
    expect(adminAuthMock.verifySessionCookie).not.toHaveBeenCalled();
  });

  it('401 when only the public tv_auth hint is present', async () => {
    expect((await get({ cookie: 'tv_auth=1' })).status).toBe(401);
  });

  it('401 for an invalid or expired cookie', async () => {
    adminAuthMock.verifySessionCookie.mockRejectedValue(new Error('expired'));
    expect((await get({ cookie: 'tv_session=expired' })).status).toBe(401);
  });

  it('404 when sign-in is off', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    expect((await get({ cookie: 'tv_session=abc' })).status).toBe(404);
  });
});
