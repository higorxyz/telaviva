import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Path of the gzip'd PGlite data directory with every migration applied. */
    pgliteTemplate: string;
  }
}

/**
 * Vitest global setup: migrates one PGlite once and hands its data directory to every test file.
 * Booting a blank PGlite runs initdb and costs about a second of CPU per file, which starves under load;
 * loading this template skips it (see `createTestDb`).
 */
export default async function setup(project: TestProject) {
  const dir = await mkdtemp(join(tmpdir(), 'telaviva-pglite-'));
  const db = new PGlite();
  await migrate(drizzle(db), { migrationsFolder: 'drizzle' });
  const dump = await db.dumpDataDir('gzip');
  await db.close();
  const file = join(dir, 'template.tar.gz');
  await writeFile(file, Buffer.from(await dump.arrayBuffer()));
  project.provide('pgliteTemplate', file);
  return () => rm(dir, { recursive: true, force: true });
}
