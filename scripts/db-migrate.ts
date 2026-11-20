import { loadEnvConfig } from '@next/env';
import { PGlite } from '@electric-sql/pglite';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { migrate as migrateNeon } from 'drizzle-orm/neon-http/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { parseServerAuthEnv } from '../src/lib/env-schema';

async function main() {
  loadEnvConfig(process.cwd());
  const { databaseUrl, databaseDriver, pgliteDir } = parseServerAuthEnv(process.env);
  const migrationsFolder = 'drizzle';
  if (databaseDriver === 'pglite') {
    const client = new PGlite(pgliteDir ?? undefined);
    await migratePglite(drizzlePglite(client), { migrationsFolder });
    await client.close();
  } else if (databaseUrl) {
    await migrateNeon(drizzleNeon(neon(databaseUrl)), { migrationsFolder });
  } else {
    throw new Error('Defina DATABASE_URL (Neon) ou DATABASE_DRIVER=pglite com PGLITE_DIR.');
  }
  console.log('Migrações aplicadas.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
