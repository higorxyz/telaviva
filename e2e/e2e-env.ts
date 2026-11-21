/**
 * The local stack `npm run e2e` brings up (playwright.config.ts): the app on 3100, the TMDb mock on 4010, the Firebase
 * Auth emulator on 9099 and an on-disk PGlite. Nothing here is a real credential: `demo-*` project ids work only
 * against the emulator, which accepts any API key and never checks the service account.
 */
export const APP_URL = 'http://localhost:3100';
export const EMULATOR_HOST = '127.0.0.1:9099';
export const EMULATOR_URL = `http://${EMULATOR_HOST}`;
export const FIREBASE_PROJECT_ID = 'demo-telaviva';
export const FIREBASE_API_KEY = 'e2e-fake-api-key';
/** Wiped and migrated before every `next start` of the E2E server (e2e/prepare-db.ts). */
export const PGLITE_DIR = '.e2e/pglite';
/** The E2E build's own output (next.config.ts `distDir`): the real `.next` is never touched by `npm run e2e`. */
export const E2E_DIST_DIR = '.e2e/next';

/**
 * Environment of the E2E build and server. `NEXT_PUBLIC_*` are inlined at build time, so the build must see these too;
 * it goes to `E2E_DIST_DIR`, type-checked with tsconfig.e2e.json (whose includes already name that directory's types,
 * so the build never rewrites the real tsconfig.json).
 * Every account-related variable is set, empty ones included: an empty value still counts as defined for Next, so
 * nothing from a developer's `.env.local` (the real Neon URL, the real service account, a `VERCEL=1` written by
 * `vercel env pull`) can leak into the test server.
 */
export const E2E_SERVER_ENV: Record<string, string> = {
  NEXT_DIST_DIR: E2E_DIST_DIR,
  NEXT_TSCONFIG_PATH: 'tsconfig.e2e.json',
  TMDB_API_BASE_URL: 'http://127.0.0.1:4010/3',
  TMDB_READ_TOKEN: 'e2e',
  NEXT_PUBLIC_SITE_URL: APP_URL,
  // One local Node process absorbs the cold-start prefetch storm of 6 browsers; its event-loop lag can exceed
  // the 8 s production TMDb timeout and turn slow-but-fine renders into uncached errors. The mock never hangs.
  TMDB_TIMEOUT_MS: '60000',

  // Sign-in against the Auth emulator. The auth domain is the site itself, as in production (the /__/auth proxy);
  // the popup and redirect that would use it are not exercised here (see e2e/auth.spec.ts).
  NEXT_PUBLIC_FIREBASE_API_KEY: FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000e2e000',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: new URL(APP_URL).host,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: EMULATOR_HOST,
  FIREBASE_PROJECT_ID: FIREBASE_PROJECT_ID,
  // In emulator mode firebase-admin is initialized with the project id only (src/server/auth/admin.ts); these two
  // only need to be present so the credential counts as configured. The key is never parsed.
  FIREBASE_CLIENT_EMAIL: `e2e@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
  FIREBASE_PRIVATE_KEY: 'e2e-fake-key-never-parsed',

  DATABASE_DRIVER: 'pglite',
  PGLITE_DIR,
  DATABASE_URL: '',
  VERCEL: '',
};
