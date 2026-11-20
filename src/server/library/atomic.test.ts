// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/server/db/client';
import { libraryItems, users } from '@/server/db/schema';
import { createTestDb } from '@/test/db';
import { writeAtomically } from './atomic';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values({ id: 'u1' });
});
afterAll(async () => {
  await db.$client.close();
});

const row = (tmdbId: number, status = 'want') => ({
  userId: 'u1',
  mediaType: 'movie',
  tmdbId,
  status,
  title: 'Filme',
});
const titles = async () =>
  (await db.select().from(libraryItems).where(eq(libraryItems.userId, 'u1'))).map((r) => r.tmdbId).sort();

describe('writeAtomically (PGlite: one transaction)', () => {
  it('runs every statement in order and returns their results', async () => {
    const results = await writeAtomically(db, (q) => [
      q.insert(libraryItems).values(row(1)),
      q.insert(libraryItems).values(row(2)),
      q.select({ id: libraryItems.tmdbId }).from(libraryItems).where(eq(libraryItems.userId, 'u1')),
    ]);
    expect(results).toHaveLength(3);
    expect(results[2]).toEqual(expect.arrayContaining([{ id: 1 }, { id: 2 }]));
    expect(await titles()).toEqual([1, 2]);
  });

  it('writes nothing when any statement fails', async () => {
    const attempt = writeAtomically(db, (q) => [
      q.delete(libraryItems).where(eq(libraryItems.tmdbId, 1)),
      q.insert(libraryItems).values(row(3)),
      // Violates library_items_status_check.
      q.insert(libraryItems).values(row(4, 'bogus')),
    ]);
    await expect(attempt).rejects.toThrow();
    expect(await titles()).toEqual([1, 2]);
  });

  it('does nothing for an empty list', async () => {
    expect(await writeAtomically(db, () => [])).toEqual([]);
  });
});

describe('writeAtomically (Neon HTTP: one db.batch)', () => {
  it('sends every statement in a single batch and never opens an interactive transaction', async () => {
    const batch = vi.fn(async (queries: unknown[]) => queries.map((_, i) => i));
    const transaction = vi.fn();
    // Statements are built with the pglite builder; only `batch` and `transaction` are observed.
    const neonLike = Object.assign(Object.create(db) as object, { batch, transaction }) as unknown as Database;
    const results = await writeAtomically(neonLike, (q) => [
      q.insert(libraryItems).values(row(5)),
      q.delete(libraryItems).where(eq(libraryItems.tmdbId, 6)),
    ]);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]![0]).toHaveLength(2);
    expect(transaction).not.toHaveBeenCalled();
    expect(results).toEqual([0, 1]);
    // Building the statements did not run them.
    expect(await titles()).toEqual([1, 2]);
  });

  it('skips the round trip for an empty list', async () => {
    const batch = vi.fn();
    const neonLike = Object.assign(Object.create(db) as object, { batch }) as unknown as Database;
    expect(await writeAtomically(neonLike, () => [])).toEqual([]);
    expect(batch).not.toHaveBeenCalled();
  });
});
