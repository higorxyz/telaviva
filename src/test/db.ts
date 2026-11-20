import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '@/server/db/schema';

/** In-memory PGlite with every migration applied. Use one instance per test file. */
export async function createTestDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  return db;
}
