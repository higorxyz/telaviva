import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { readFile } from 'node:fs/promises';
import { inject } from 'vitest';
import * as schema from '@/server/db/schema';

/**
 * In-memory PGlite with every migration applied. Use one instance per test file.
 * Starts from the template the global setup migrated once (`db-template.ts`); without it, migrates from scratch.
 */
export async function createTestDb() {
  const template = inject('pgliteTemplate');
  if (!template) {
    const db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: 'drizzle' });
    return db;
  }
  const loadDataDir = new Blob([await readFile(template)]);
  return drizzle(new PGlite({ loadDataDir }), { schema });
}
