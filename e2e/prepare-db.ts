import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { PGLITE_DIR } from './e2e-env';

/**
 * Gives the E2E server an empty, migrated PGlite. It runs inside the app's webServer command, between the build and
 * `next start` (playwright.config.ts): Playwright starts web servers before globalSetup, and `next start` opens the
 * directory for good on its first account request, so this is the last moment it can be replaced.
 *
 * The path is the fixed E2E one, never read from the environment, so this can only ever wipe `.e2e/pglite`.
 */
async function main() {
  const dir = path.resolve(PGLITE_DIR);
  await rm(dir, { recursive: true, force: true });
  await mkdir(path.dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
  await client.close();
  console.log(`E2E database ready: ${PGLITE_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
