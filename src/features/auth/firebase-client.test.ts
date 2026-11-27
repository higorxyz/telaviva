import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFirebase, resetFirebaseClient } from './firebase-client';
import { app, authConfig, fakeAuth, resetFakeFirebase, sdk } from './test-firebase';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

beforeEach(() => {
  resetFakeFirebase();
  resetFirebaseClient();
  authConfig.enabled = true;
  authConfig.emulatorHost = null;
  authConfig.local = true;
});

describe('loadFirebase', () => {
  it('sets up Auth once with local persistence, and the emulator when configured', async () => {
    authConfig.emulatorHost = '127.0.0.1:9099';
    const client = await loadFirebase();
    await loadFirebase();
    expect(client.auth).toBe(fakeAuth);
    expect(sdk.initializeAuth).toHaveBeenCalledTimes(1);
    expect(sdk.initializeAuth.mock.calls[0][1]).toMatchObject({ persistence: sdk.browserLocalPersistence });
    expect(sdk.connectAuthEmulator).toHaveBeenCalledWith(fakeAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  });

  it('refuses the emulator off localhost, before loading or setting up anything', async () => {
    authConfig.emulatorHost = '127.0.0.1:9099';
    authConfig.local = false;
    await expect(loadFirebase()).rejects.toThrow('only works on localhost');
    expect(app.initializeApp).not.toHaveBeenCalled();
    expect(sdk.initializeAuth).not.toHaveBeenCalled();
    expect(sdk.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('works anywhere without an emulator host', async () => {
    authConfig.local = false;
    await expect(loadFirebase()).resolves.toMatchObject({ auth: fakeAuth });
    expect(sdk.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it('reuses the Auth instance when a retry follows a partial failure', async () => {
    const ready = fakeAuth.authStateReady;
    fakeAuth.authStateReady = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    try {
      await expect(loadFirebase()).rejects.toThrow('offline');
      await expect(loadFirebase()).resolves.toMatchObject({ auth: fakeAuth });
      expect(sdk.initializeAuth).toHaveBeenCalledTimes(1);
    } finally {
      fakeAuth.authStateReady = ready;
    }
  });
});
