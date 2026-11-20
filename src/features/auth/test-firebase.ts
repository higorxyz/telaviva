import { vi } from 'vitest';

/**
 * A stand-in for `firebase/app` and `firebase/auth`, wired in by test files with
 * `vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule)`.
 * `log` records the calls in order, so tests can check what happened before what.
 */

export type FakeUser = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  getIdToken: ReturnType<typeof vi.fn<(force?: boolean) => Promise<string>>>;
  reload: ReturnType<typeof vi.fn<() => Promise<void>>>;
};

export const log: string[] = [];

export const fakeAuth: { currentUser: FakeUser | null; authStateReady: () => Promise<void> } = {
  currentUser: null,
  authStateReady: async () => {},
};

export function fakeUser(uid = 'u1', overrides: Partial<Omit<FakeUser, 'getIdToken' | 'reload'>> = {}): FakeUser {
  const user: FakeUser = {
    uid,
    email: `${uid}@exemplo.com`,
    emailVerified: false,
    displayName: null,
    getIdToken: vi.fn(async (force?: boolean) => {
      log.push(`getIdToken:${force === true}`);
      return `token-${uid}`;
    }),
    reload: vi.fn(async () => {
      log.push('reload');
    }),
    ...overrides,
  };
  return user;
}

/** A Firebase-style error: the SDK's errors carry `code`. */
export const authError = (code: string) => Object.assign(new Error(code), { code });

const credential = (user: FakeUser) => ({ user });

export const sdk = {
  initializeAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
  browserLocalPersistence: { type: 'LOCAL' },
  browserPopupRedirectResolver: { type: 'resolver' },
  GoogleAuthProvider: class GoogleAuthProvider {},
  signInWithPopup: vi.fn(),
  signInWithRedirect: vi.fn(),
  getRedirectResult: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  sendEmailVerification: vi.fn(),
  signOut: vi.fn(),
};

export const app = { initializeApp: vi.fn(), getApps: vi.fn() };

/** Default behaviour: every sign-in succeeds as `u1`, nothing is pending. */
export function resetFakeFirebase(): void {
  log.length = 0;
  fakeAuth.currentUser = null;
  const signIn = (name: string) => async () => {
    log.push(name);
    fakeAuth.currentUser = fakeUser('u1');
    return credential(fakeAuth.currentUser);
  };
  sdk.initializeAuth.mockReset().mockImplementation(() => fakeAuth);
  sdk.connectAuthEmulator.mockReset();
  sdk.signInWithPopup.mockReset().mockImplementation(signIn('signInWithPopup'));
  sdk.signInWithRedirect.mockReset().mockImplementation(async () => {
    log.push('signInWithRedirect');
  });
  sdk.getRedirectResult.mockReset().mockImplementation(async () => {
    log.push('getRedirectResult');
    return null;
  });
  sdk.signInWithEmailAndPassword.mockReset().mockImplementation(signIn('signInWithEmailAndPassword'));
  sdk.createUserWithEmailAndPassword.mockReset().mockImplementation(signIn('createUser'));
  sdk.updateProfile.mockReset().mockImplementation(async (user: FakeUser, profile: { displayName?: string }) => {
    log.push(`updateProfile:${profile.displayName}`);
    user.displayName = profile.displayName ?? null;
  });
  sdk.sendEmailVerification.mockReset().mockImplementation(async () => {
    log.push('sendEmailVerification');
  });
  sdk.signOut.mockReset().mockImplementation(async () => {
    log.push('signOut');
    fakeAuth.currentUser = null;
  });
  app.initializeApp.mockReset().mockImplementation(() => ({ name: '[DEFAULT]' }));
  app.getApps.mockReset().mockImplementation(() => []);
}

resetFakeFirebase();

export const fakeAuthModule = sdk;
export const fakeAppModule = app;

/** Mutable stand-in for `@/lib/auth-config` (its values are build-time constants in the app). */
export const authConfig = { enabled: true, emulatorHost: null as string | null };

export const fakeAuthConfigModule = {
  get authEnabled() {
    return authConfig.enabled;
  },
  get publicFirebaseConfig() {
    return authConfig.enabled ? { apiKey: 'k', authDomain: 'localhost', projectId: 'demo', appId: 'a' } : null;
  },
  get authEmulatorHost() {
    return authConfig.emulatorHost;
  },
};
