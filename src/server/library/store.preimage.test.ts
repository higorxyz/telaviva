// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { LibraryCommand } from '@/features/library/commands';
import type { TitleRef } from '@/features/library/types';
import { episodeProgress, libraryItems, ratings, users } from '@/server/db/schema';
import { createTestDb } from '@/test/db';
import { applyLibraryCommand } from './store';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values({ id: 'ana' });
});
afterAll(async () => {
  await db.$client.close();
});
beforeEach(async () => {
  await db.delete(libraryItems);
  await db.delete(ratings);
  await db.delete(episodeProgress);
});

const T0 = '2026-11-20T10:00:00.000Z';
const T1 = '2026-11-20T11:00:00.000Z';
const NOW = '2026-11-20T12:00:00.000Z';
const snapshot = { title: 'Família Soprano', posterPath: null, releaseDate: null, genreIds: [] };
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const tv: TitleRef = { mediaType: 'tv', tmdbId: 1398 };
const row = { userId: 'ana', title: 'Família Soprano', addedAt: T0 };

describe('applyLibraryCommand: the pre-image for undo', () => {
  it('is the title as the server loaded it for the command, another device’s change included', async () => {
    // Another device marked it watched (and rated it) after this tab last loaded the list.
    await db.insert(libraryItems).values({ ...row, ...movie, status: 'watched', updatedAt: T1, watchedAt: T1 });
    await db.insert(ratings).values({ userId: 'ana', ...movie, score: 9, ratedAt: T1, updatedAt: T1 });
    const remove: LibraryCommand = { type: 'remove', ref: movie };
    const { state, previous } = await applyLibraryCommand(db, 'ana', remove, NOW);
    expect(state.items).toEqual([]);
    expect(previous.item).toMatchObject({ ...movie, status: 'watched', watchedAt: T1, updatedAt: T1 });
    expect(previous.rating).toMatchObject({ ...movie, score: 9 });
    expect(previous.marks).toEqual([]);
  });

  it("holds a series' marks from before an episode command, and nothing for a title not in the list", async () => {
    await db.insert(libraryItems).values({ ...row, ...tv, status: 'watching', updatedAt: T0 });
    await db.insert(episodeProgress).values({ userId: 'ana', tvId: tv.tmdbId, seasonNumber: 1, episodeNumber: 1, watchedAt: T0 });
    const progress = {
      tvId: tv.tmdbId,
      ended: true,
      seasons: [{ seasonNumber: 1, episodeCount: 3 }],
      lastAired: { seasonNumber: 1, episodeNumber: 3 },
      nextToAir: null,
    };
    const mark: LibraryCommand = {
      type: 'setEpisodes',
      tvId: tv.tmdbId,
      marks: [{ seasonNumber: 1, episodeNumber: 2 }],
      watched: true,
      snapshot,
      progress,
    };
    const { previous } = await applyLibraryCommand(db, 'ana', mark, NOW);
    expect(previous.marks).toEqual([{ tvId: tv.tmdbId, seasonNumber: 1, episodeNumber: 1, watchedAt: T0 }]);
    expect(previous.item).toMatchObject({ status: 'watching' });

    const want: LibraryCommand = { type: 'setStatus', ref: movie, status: 'want', snapshot };
    expect((await applyLibraryCommand(db, 'ana', want, NOW)).previous).toEqual({ item: null, rating: null, marks: [] });
  });
});
