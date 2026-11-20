import { vi } from 'vitest';

/**
 * Stand-in for the firebase-admin Auth instance. Wire it in a test file with:
 *   vi.mock('firebase-admin/app', async () => (await import('@/test/admin-auth')).adminAppModule);
 *   vi.mock('firebase-admin/auth', async () => (await import('@/test/admin-auth')).adminAuthModule);
 */
export const adminAuthMock = {
  verifyIdToken: vi.fn(),
  createSessionCookie: vi.fn(),
  verifySessionCookie: vi.fn(),
  revokeRefreshTokens: vi.fn(),
};

export const adminAppModule = {
  initializeApp: vi.fn((_options: unknown, name: string) => ({ name })),
  getApps: vi.fn(() => []),
  cert: vi.fn((serviceAccount: unknown) => ({ serviceAccount })),
};

export const adminAuthModule = { getAuth: vi.fn(() => adminAuthMock) };

export function resetAdminAuthMock() {
  for (const fn of Object.values(adminAuthMock)) fn.mockReset();
  delete (globalThis as { __telavivaAdminAuth?: unknown }).__telavivaAdminAuth;
}

/** A decoded Firebase token (ID token or session cookie) as firebase-admin returns it. */
export function decodedToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    uid: 'user-1',
    sub: 'user-1',
    email: 'ana@example.com',
    email_verified: true,
    name: 'Ana',
    picture: 'https://example.com/ana.png',
    auth_time: now - 10,
    iat: now - 10,
    exp: now + 3600,
    aud: 'demo-telaviva',
    iss: 'https://securetoken.google.com/demo-telaviva',
    firebase: { identities: {}, sign_in_provider: 'google.com' },
    ...overrides,
  };
}

/** The env that turns sign-in on in tests (fake key: firebase-admin is mocked, so it is never parsed). */
export function stubAuthEnv(stubEnv: (name: string, value: string) => unknown) {
  stubEnv('FIREBASE_PROJECT_ID', 'demo-telaviva');
  stubEnv('FIREBASE_CLIENT_EMAIL', 'test@demo-telaviva.iam.gserviceaccount.com');
  stubEnv('FIREBASE_PRIVATE_KEY', 'fake-key');
  stubEnv('DATABASE_DRIVER', 'pglite');
  stubEnv('DATABASE_URL', '');
}
