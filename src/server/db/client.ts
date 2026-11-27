import 'server-only';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { serverAuthEnv } from '@/lib/env';
import { SetupError } from '@/lib/setup-error';
import * as schema from './schema';

/**
 * Common supertype of both drivers, enough for select/insert/update/delete.
 * Batched writes differ per driver: neon-http has `db.batch([...])` and no interactive
 * transactions; pglite has `db.transaction`. Neither exists on this common type.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as typeof globalThis & { __telavivaDb?: Promise<Database> };

async function open(): Promise<Database> {
  const { databaseUrl, databaseDriver, pgliteDir } = serverAuthEnv();
  if (databaseDriver === 'pglite') {
    // Loaded only here, so production bundles never carry PGlite (a dev dependency).
    const { openPglite } = await import('./pglite');
    return (await openPglite(pgliteDir)) as unknown as Database;
  }
  if (databaseUrl) return drizzleNeon(neon(databaseUrl), { schema });
  throw new SetupError(
    'Banco de dados não configurado: defina DATABASE_URL (Neon) ou DATABASE_DRIVER=pglite com PGLITE_DIR.',
  );
}

/**
 * The database, opened once. Cached on globalThis (as a promise, so concurrent first calls share one) so Next dev
 * hot reloads reuse one PGlite instead of reopening its directory. A failed opening is not cached.
 */
export function getDb(): Promise<Database> {
  globalForDb.__telavivaDb ??= open().catch((error: unknown) => {
    globalForDb.__telavivaDb = undefined;
    throw error;
  });
  return globalForDb.__telavivaDb;
}
