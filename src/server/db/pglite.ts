import 'server-only';
import * as schema from './schema';

/**
 * Opens the in-process Postgres used by the tests and the E2E build (DATABASE_DRIVER=pglite). PGlite is a dev
 * dependency: both imports are left to Node at run time (`turbopackIgnore`), so a production build never traces or
 * bundles it, and a deployment without it never loads this module.
 */
export async function openPglite(dir: string | null) {
  const [{ PGlite }, { drizzle }] = await Promise.all([
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '@electric-sql/pglite'),
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'drizzle-orm/pglite'),
  ]);
  return drizzle(new PGlite(dir ?? undefined), { schema });
}
