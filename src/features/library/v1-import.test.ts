import { describe, expect, it } from 'vitest';
import { importV1 } from './v1-import';

const NOW = '2026-11-19T12:00:00.000Z';

function fakeStorage(data: Record<string, string>): Storage {
  return {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}

describe('importV1', () => {
  it('maps TMDb fields into watched and want movie items', () => {
    const items = importV1(
      fakeStorage({
        watchedMovies: JSON.stringify([
          { id: 550, title: 'Clube da Luta', poster_path: '/a.jpg', release_date: '1999-10-15', genre_ids: [18] },
        ]),
        toWatchMovies: JSON.stringify([{ id: 603, title: 'Matrix' }]),
      }),
      NOW,
    );
    expect(items).toEqual([
      {
        mediaType: 'movie',
        tmdbId: 550,
        status: 'watched',
        addedAt: NOW,
        updatedAt: NOW,
        watchedAt: NOW,
        snapshot: { title: 'Clube da Luta', posterPath: '/a.jpg', releaseDate: '1999-10-15', genreIds: [18] },
      },
      {
        mediaType: 'movie',
        tmdbId: 603,
        status: 'want',
        addedAt: NOW,
        updatedAt: NOW,
        watchedAt: null,
        snapshot: { title: 'Matrix', posterPath: null, releaseDate: null, genreIds: [] },
      },
    ]);
  });

  it('lets watched win when a movie is in both lists', () => {
    const items = importV1(
      fakeStorage({
        watchedMovies: JSON.stringify([{ id: 1, title: 'A' }]),
        toWatchMovies: JSON.stringify([{ id: 1, title: 'A' }]),
      }),
      NOW,
    );
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('watched');
  });

  it('drops entries without a numeric id', () => {
    const items = importV1(
      fakeStorage({
        watchedMovies: JSON.stringify([{ title: 'x' }, { id: '5', title: 'y' }, null, 7, { id: 9, title: 'ok' }]),
      }),
      NOW,
    );
    expect(items.map((i) => i.tmdbId)).toEqual([9]);
  });

  it('returns [] for broken JSON, non-arrays or missing keys', () => {
    expect(importV1(fakeStorage({ watchedMovies: '{oops', toWatchMovies: '{"a":1}' }), NOW)).toEqual([]);
    expect(importV1(fakeStorage({}), NOW)).toEqual([]);
  });
});
