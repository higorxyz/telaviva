import 'server-only';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Database } from '@/server/db/client';

/** A statement built but not yet run (insert, delete, select or raw SQL). */
export type Statement = BatchItem<'pg'> & PromiseLike<unknown>;

type Batchable = { batch(queries: readonly [Statement, ...Statement[]]): Promise<unknown[]> };

const canBatch = (db: Database): db is Database & Batchable =>
  'batch' in db && typeof (db as Partial<Batchable>).batch === 'function';

/**
 * Runs the statements `build` returns, all or none, and resolves to their results in order.
 *
 * - neon-http (production): one `db.batch`. Neon sends the whole list in a single HTTP request and runs it as one
 *   non-interactive transaction (BEGIN … COMMIT); any failing statement rolls every one back.
 * - pglite (tests, local): an interactive `db.transaction`, statements run one after another; a throw rolls back.
 *
 * `build` receives the handle to build with (the database, or the open transaction).
 */
export async function writeAtomically(db: Database, build: (q: Database) => Statement[]): Promise<unknown[]> {
  if (canBatch(db)) {
    const [first, ...rest] = build(db);
    if (!first) return [];
    return db.batch([first, ...rest]);
  }
  return db.transaction(async (tx) => {
    const results: unknown[] = [];
    for (const statement of build(tx)) results.push(await statement);
    return results;
  });
}
