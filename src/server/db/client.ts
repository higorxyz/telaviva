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

const globalForDb = globalThis as typeof globalThis & { __telavivaDb?: Database };

/** Cached on globalThis so Next dev hot reloads reuse one PGlite instead of reopening its directory. */
export function getDb(): Database {
  if (globalForDb.__telavivaDb) return globalForDb.__telavivaDb;
  const { databaseUrl, databaseDriver, pgliteDir } = serverAuthEnv();
  if (databaseDriver === 'pglite') {
    globalForDb.__telavivaDb = drizzlePglite(new PGlite(pgliteDir ?? undefined), { schema });
  } else if (databaseUrl) {
    globalForDb.__telavivaDb = drizzleNeon(neon(databaseUrl), { schema });
  } else {
    throw new Error(
      'Banco de dados não configurado: defina DATABASE_URL (Neon) ou DATABASE_DRIVER=pglite com PGLITE_DIR.',
    );
  }
  return globalForDb.__telavivaDb;
}
