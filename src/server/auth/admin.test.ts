// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminAppModule,
  adminAuthMock,
  adminAuthModule,
  resetAdminAuthMock,
  stubAuthEnv,
} from '@/test/admin-auth';

vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);

import { getAdminAuth } from './admin';

beforeEach(() => {
  resetAdminAuthMock();
  adminAppModule.initializeApp.mockClear();
  adminAppModule.getApps.mockClear();
  adminAppModule.cert.mockClear();
  stubAuthEnv(vi.stubEnv);
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
  vi.stubEnv('VERCEL', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('getAdminAuth', () => {
  it('initializes a named app with the service account and memoizes it on globalThis', () => {
    const auth = getAdminAuth();
    expect(auth).toBe(adminAuthMock);
    expect(adminAppModule.cert).toHaveBeenCalledWith({
      projectId: 'demo-telaviva',
      clientEmail: 'test@demo-telaviva.iam.gserviceaccount.com',
      privateKey: 'fake-key\n',
    });
    expect(adminAppModule.initializeApp).toHaveBeenCalledWith(
      { credential: { serviceAccount: expect.any(Object) } },
      'telaviva',
    );
    expect(adminAuthModule.getAuth).toHaveBeenCalledWith({ name: 'telaviva' });

    expect(getAdminAuth()).toBe(auth);
    expect(adminAppModule.initializeApp).toHaveBeenCalledTimes(1);
  });

  it('reuses an app that already exists (hot reload) instead of initializing a duplicate', () => {
    adminAppModule.getApps.mockReturnValueOnce([{ name: 'telaviva' }] as never);
    getAdminAuth();
    expect(adminAppModule.initializeApp).not.toHaveBeenCalled();
  });

  it('with the Auth Emulator, initializes with the project id only (the key is never parsed)', () => {
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    getAdminAuth();
    expect(adminAppModule.cert).not.toHaveBeenCalled();
    expect(adminAppModule.initializeApp).toHaveBeenCalledWith(
      { projectId: 'demo-telaviva' },
      'telaviva',
    );
  });

  it('refuses the emulator on Vercel, where it would skip token signature checks', () => {
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('DATABASE_DRIVER', '');
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@host/db');
    expect(() => getAdminAuth()).toThrow(/FIREBASE_AUTH_EMULATOR_HOST/);
  });

  it('throws when the Firebase credential is missing', () => {
    vi.stubEnv('FIREBASE_PRIVATE_KEY', '');
    expect(() => getAdminAuth()).toThrow(/Firebase/);
  });
});
