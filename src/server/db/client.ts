import 'server-only';
import { neon } from '@neondatabase/serverless';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { serverAuthEnv } from '@/lib/env';
import * as schema from './schema';

/**
 * Common supertype of both drivers, enough for select/insert/update/delete.
 * Batched writes differ per driver: neon-http has `db.batch([...])` and no interactive
 * transactions; pglite has `db.transaction`. Neither exists on this common type.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

let instance: Database | undefined;

export function getDb(): Database {
  if (instance) return instance;
  const { databaseUrl, databaseDriver, pgliteDir } = serverAuthEnv();
  if (databaseDriver === 'pglite') {
    instance = drizzlePglite(new PGlite(pgliteDir ?? undefined), { schema });
  } else if (databaseUrl) {
    instance = drizzleNeon(neon(databaseUrl), { schema });
  } else {
    throw new Error(
      'Banco de dados não configurado: defina DATABASE_URL (Neon) ou DATABASE_DRIVER=pglite com PGLITE_DIR.',
    );
  }
  return instance;
}
