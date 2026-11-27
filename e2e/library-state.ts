import type { Page } from '@playwright/test';

/** The guest library key and schema (src/features/library), seeded straight into storage for specs that need a full list. */
export const LIBRARY_KEY = 'telaviva:library:v1';

const at = (day: number) => `2026-11-${String(day).padStart(2, '0')}T12:00:00.000Z`;

/** A series in progress (T1E1–T1E5 seen), a rated watched movie and two in Quero ver. */
export const FILLED_LIBRARY = {
  version: 1,
  items: [
    {
      mediaType: 'tv',
      tmdbId: 1399,
      status: 'watching',
      addedAt: at(10),
      updatedAt: at(15),
      watchedAt: null,
      snapshot: {
        title: 'Game of Thrones',
        posterPath: '/aqomTRKjNZkmNEeOZnEmWrFTmKU.jpg',
        releaseDate: '2011-04-17',
        genreIds: [10765, 18, 10759],
      },
    },
    {
      mediaType: 'movie',
      tmdbId: 550,
      status: 'watched',
      addedAt: at(11),
      updatedAt: at(14),
      watchedAt: at(14),
      snapshot: { title: 'Clube da Luta', posterPath: '/mCICnh7QBH0gzYaTQChBDDVIKdm.jpg', releaseDate: '1999-10-15', genreIds: [18, 53] },
    },
    {
      mediaType: 'movie',
      tmdbId: 1101412,
      status: 'want',
      addedAt: at(12),
      updatedAt: at(12),
      watchedAt: null,
      snapshot: { title: 'A Queda 2: No Limite', posterPath: '/xtxEvJACNnbz3WYmJ5mYT1a0KGk.jpg', releaseDate: '2026-09-01', genreIds: [53] },
    },
    {
      mediaType: 'movie',
      tmdbId: 1228834,
      status: 'want',
      addedAt: at(13),
      updatedAt: at(13),
      watchedAt: null,
      snapshot: { title: 'The Fix', posterPath: '/a1j5writymMPFPyOhBT7s1xX6v6.jpg', releaseDate: '2026-09-10', genreIds: [28, 53] },
    },
  ],
  episodes: [1, 2, 3, 4, 5].map((episodeNumber) => ({ tvId: 1399, seasonNumber: 1, episodeNumber, watchedAt: at(15) })),
  ratings: [{ mediaType: 'movie', tmdbId: 550, score: 9, ratedAt: at(14), updatedAt: at(14) }],
};

/** Writes the library before any page script runs, once per test (a reload keeps what the page saved since). */
export async function seedLibrary(page: Page, state: unknown = FILLED_LIBRARY): Promise<void> {
  await page.addInitScript(
    ([key, json]) => {
      if (window.localStorage.getItem(key) === null) window.localStorage.setItem(key, json);
    },
    [LIBRARY_KEY, JSON.stringify(state)] as const,
  );
}

/** Number of saved items, read from the page's own storage. */
export function savedItemCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw === null ? 0 : (JSON.parse(raw) as { items: unknown[] }).items.length;
  }, LIBRARY_KEY);
}
