// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminAuthError, adminAuthMock, decodedToken, resetAdminAuthMock, stubAuthEnv } from '@/test/admin-auth';

vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { authGate, authRoutesEnabled, requireUser } from './guard';

const ORIGIN = 'http://localhost:3000';
const req = (method: string, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}/api/library/state`, {
    method,
    headers: { host: 'localhost:3000', ...headers },
  });

beforeEach(() => {
  resetAdminAuthMock();
  stubAuthEnv(vi.stubEnv);
  adminAuthMock.verifySessionCookie.mockResolvedValue(decodedToken());
});
afterEach(() => vi.unstubAllEnvs());

describe('authRoutesEnabled / authGate', () => {
  it('404 for every method when sign-in is off', async () => {
    vi.stubEnv('DATABASE_DRIVER', '');
    expect(authRoutesEnabled()).toBe(false);
    for (const method of ['GET', 'POST', 'DELETE']) {
      const res = authGate(req(method, { origin: ORIGIN }));
      expect(res?.status).toBe(404);
      expect(await res?.json()).toEqual({ error: 'not_found' });
    }
  });

  it('lets GET through without an Origin and checks it on state-changing methods', async () => {
    expect(authRoutesEnabled()).toBe(true);
    expect(authGate(req('GET'))).toBeNull();
    expect(authGate(req('POST', { origin: ORIGIN }))).toBeNull();
    const res = authGate(req('PUT', { origin: 'https://evil.example' }));
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: 'forbidden' });
    expect(authGate(req('DELETE'))?.status).toBe(403);
  });
});

describe('requireUser', () => {
  it('returns the SessionUser from tv_session', async () => {
    const user = await requireUser(
      req('GET', { cookie: 'other=1; tv_session=abc.def.ghi; tv_auth=1' }),
    );
    expect(user).toMatchObject({ id: 'user-1', email: 'ana@example.com' });
    expect(adminAuthMock.verifySessionCookie).toHaveBeenCalledWith('abc.def.ghi', false);
  });

  it('401 { error: "unauthenticated" } without a cookie or with a rejected one', async () => {
    const missing = await requireUser(req('GET', { cookie: 'tv_auth=1' }));
    expect(missing).toBeInstanceOf(Response);
    expect((missing as Response).status).toBe(401);
    expect(await (missing as Response).json()).toEqual({ error: 'unauthenticated' });

    adminAuthMock.verifySessionCookie.mockRejectedValue(adminAuthError('auth/session-cookie-revoked'));
    const rejected = await requireUser(req('GET', { cookie: 'tv_session=x' }));
    expect((rejected as Response).status).toBe(401);
  });

  it('503 { error: "unavailable" } when the cookie cannot be checked right now', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    adminAuthMock.verifySessionCookie.mockRejectedValue(adminAuthError('app/network-error'));
    const res = await requireUser(req('GET', { cookie: 'tv_session=x' }));
    expect((res as Response).status).toBe(503);
    expect(await (res as Response).json()).toEqual({ error: 'unavailable' });
    log.mockRestore();
  });

  it('403 before reading the session when a state-changing request comes from another origin', async () => {
    const res = await requireUser(
      req('POST', { cookie: 'tv_session=x', origin: 'https://evil.example' }),
    );
    expect((res as Response).status).toBe(403);
    expect(adminAuthMock.verifySessionCookie).not.toHaveBeenCalled();
  });

  it('passes checkRevoked through', async () => {
    await requireUser(req('DELETE', { cookie: 'tv_session=x', origin: ORIGIN }), {
      checkRevoked: true,
    });
    expect(adminAuthMock.verifySessionCookie).toHaveBeenCalledWith('x', true);
  });

  it('404 when sign-in is off, even with a cookie', async () => {
    vi.stubEnv('FIREBASE_CLIENT_EMAIL', '');
    expect(((await requireUser(req('GET', { cookie: 'tv_session=x' }))) as Response).status).toBe(
      404,
    );
  });
});
