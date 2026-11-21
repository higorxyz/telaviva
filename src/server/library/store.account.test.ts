// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LibraryCommand } from '@/features/library/commands';
import { libraryItems, users } from '@/server/db/schema';
import { createTestDb } from '@/test/db';
import { LibraryAccountMissingError } from './errors';
import { mergeGuestLibrary } from './merge';
import { applyLibraryCommand, loadAccountLibrary, loadLibrary } from './store';

let db: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  db = await createTestDb();
  await db.insert(users).values({ id: 'ana' });
  await db.insert(libraryItems).values({ userId: 'ana', mediaType: 'movie', tmdbId: 550, status: 'want', title: 'Clube da Luta' });
});
afterAll(async () => {
  await db.$client.close();
});

const NOW = '2026-11-20T12:00:00.000Z';
const want: LibraryCommand = {
  type: 'setStatus',
  ref: { mediaType: 'movie', tmdbId: 13 },
  status: 'want',
  snapshot: { title: 'Forrest Gump', posterPath: null, releaseDate: null, genreIds: [] },
};

describe('the account check folded into the library statement', () => {
  it('loadAccountLibrary reads the library of a user who has an account', async () => {
    expect((await loadAccountLibrary(db, 'ana')).items.map((i) => i.tmdbId)).toEqual([550]);
  });

  it('loadAccountLibrary throws LibraryAccountMissingError for a user without a row (deleted elsewhere)', async () => {
    await expect(loadAccountLibrary(db, 'gone')).rejects.toBeInstanceOf(LibraryAccountMissingError);
  });

  it('a command or a merge for a user without a row throws it too, writing nothing', async () => {
    await expect(applyLibraryCommand(db, 'gone', want, NOW)).rejects.toBeInstanceOf(LibraryAccountMissingError);
    const guest = { version: 1 as const, items: [], episodes: [], ratings: [] };
    await expect(mergeGuestLibrary(db, 'gone', guest, NOW)).rejects.toBeInstanceOf(LibraryAccountMissingError);
    expect((await loadLibrary(db, 'gone')).items).toEqual([]);
  });
});
