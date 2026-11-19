import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npx tsx e2e/mock-tmdb.ts',
      port: 4010,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run start -- -p 3100',
      port: 3100,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      env: {
        TMDB_API_BASE_URL: 'http://127.0.0.1:4010/3',
        TMDB_READ_TOKEN: 'e2e',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
        // One local Node process absorbs the cold-start prefetch storm of 6 browsers; its event-loop lag can exceed
        // the 8 s production TMDb timeout and turn slow-but-fine renders into uncached errors. The mock never hangs.
        TMDB_TIMEOUT_MS: '60000',
      },
    },
  ],
});
