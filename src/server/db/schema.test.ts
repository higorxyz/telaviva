// @vitest-environment node
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/test/db';
import { episodeProgress, libraryItems, ratings, users } from './schema';

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.$client.close();
});

const item = (userId: string, tmdbId: number, extra: Record<string, unknown> = {}) => ({
  userId,
  mediaType: 'movie',
  tmdbId,
  status: 'want',
  title: 'Filme',
  ...extra,
});

describe('schema', () => {
  it('stores users and library items, with genre_ids as an array', async () => {
    await db.insert(users).values({ id: 'u1', email: 'a@b.c', name: 'A' });
    await db.insert(libraryItems).values(item('u1', 1, { genreIds: [18, 35] }));
    await db.insert(libraryItems).values(item('u1', 2));
    const rows = await db.select().from(libraryItems).where(eq(libraryItems.userId, 'u1'));
    expect(rows.find((r) => r.tmdbId === 1)?.genreIds).toEqual([18, 35]);
    expect(rows.find((r) => r.tmdbId === 2)?.genreIds).toEqual([]);
    expect(rows[0].posterPath).toBeNull();
  });

  it('returns timestamps as strings that Date can parse', async () => {
    const [row] = await db.select().from(libraryItems).where(eq(libraryItems.tmdbId, 1));
    expect(typeof row.addedAt).toBe('string');
    expect(Number.isNaN(new Date(row.addedAt).getTime())).toBe(false);
    expect(row.watchedAt).toBeNull();
  });

  it('rejects duplicate (user, media type, tmdb id)', async () => {
    await expect(db.insert(libraryItems).values(item('u1', 1))).rejects.toThrow();
  });

  it('rejects an invalid status or media type', async () => {
    await expect(db.insert(libraryItems).values(item('u1', 3, { status: 'x' }))).rejects.toThrow();
    await expect(db.insert(libraryItems).values(item('u1', 4, { mediaType: 'x' }))).rejects.toThrow();
  });

  it('rejects an item for an unknown user', async () => {
    await expect(db.insert(libraryItems).values(item('ghost', 9))).rejects.toThrow();
  });

  it('enforces rating scores from 1 to 10 and uniqueness', async () => {
    const rating = (score: number) => ({ userId: 'u1', mediaType: 'movie', tmdbId: 1, score });
    await expect(db.insert(ratings).values(rating(11))).rejects.toThrow();
    await expect(db.insert(ratings).values(rating(0))).rejects.toThrow();
    await db.insert(ratings).values(rating(10));
    await expect(db.insert(ratings).values(rating(5))).rejects.toThrow();
  });

  it('enforces episode uniqueness', async () => {
    const ep = { userId: 'u1', tvId: 5, seasonNumber: 1, episodeNumber: 1 };
    await db.insert(episodeProgress).values(ep);
    await expect(db.insert(episodeProgress).values(ep)).rejects.toThrow();
  });

  it('cascades user deletion to every child table', async () => {
    await db.delete(users).where(eq(users.id, 'u1'));
    for (const table of ['library_items', 'episode_progress', 'ratings']) {
      const res = await db.execute(sql.raw(`select count(*)::int as n from ${table}`));
      expect((res.rows[0] as { n: number }).n).toBe(0);
    }
  });
});
