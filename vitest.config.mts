import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': fileURLToPath(new URL('./src/test/empty.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 15_000,
    // A file's setup hook can wait on a busy CPU when the whole suite runs in parallel.
    hookTimeout: 30_000,
    globalSetup: ['src/test/db-template.ts'],
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    env: {
      TMDB_READ_TOKEN: 'test-token',
      TMDB_API_BASE_URL: 'https://api.themoviedb.org/3',
    },
  },
});
