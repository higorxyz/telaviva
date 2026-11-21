import { defineConfig, devices } from '@playwright/test';
import { APP_URL, E2E_SERVER_ENV, EMULATOR_URL, FIREBASE_PROJECT_ID } from './e2e/e2e-env';

export default defineConfig({
  testDir: 'e2e',
  // Web servers start first (Playwright runs them before globalSetup); the setup then clears the Auth emulator and
  // warms the routes.
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // Firebase Auth emulator (firebase.json: port 9099, no UI). It runs on Node alone (no Java, nothing to
      // download), and a `demo-*` project id needs no Google credentials.
      command: `npx firebase emulators:start --only auth --project ${FIREBASE_PROJECT_ID}`,
      url: EMULATOR_URL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx tsx e2e/mock-tmdb.ts',
      port: 4010,
      reuseExistingServer: !process.env.CI,
    },
    {
      // The production build with the E2E environment (NEXT_PUBLIC_* are inlined here, so `npm run build` must run
      // again with the real .env.local afterwards), then a fresh migrated PGlite, then the server.
      command: 'npm run build && npx tsx e2e/prepare-db.ts && npm run start -- -p 3100',
      port: 3100,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      env: E2E_SERVER_ENV,
    },
  ],
});
