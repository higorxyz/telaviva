import { describe, expect, it } from 'vitest';
import { applyCommand, findItem, findRating, itemKey, type LibraryCommand } from './commands';
import { EMPTY_LIBRARY, type LibraryState, type LibraryStatus, type TitleRef, type TitleSnapshot } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const LATER = '2026-11-20T12:00:00.000Z';
const snapshot: TitleSnapshot = {
  title: 'Clube da Luta',
  posterPath: '/p.jpg',
  releaseDate: '1999-10-15',
  genreIds: [18],
};
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const tv: TitleRef = { mediaType: 'tv', tmdbId: 1399 };

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const setStatus = (state: LibraryState, ref: TitleRef, status: LibraryStatus, now = NOW) =>
  applyCommand(state, { type: 'setStatus', ref, status, snapshot }, now);

describe('itemKey', () => {
  it('joins type and id', () => {
    expect(itemKey(movie)).toBe('movie:550');
  });
});

describe('setStatus', () => {
  it('creates a movie item as want with timestamps and no watchedAt', () => {
    const next = setStatus(EMPTY_LIBRARY, movie, 'want');
    expect(next.items).toEqual([
      { ...movie, status: 'want', addedAt: NOW, updatedAt: NOW, watchedAt: null, snapshot },
    ]);
  });

  it('sets watchedAt when a movie becomes watched', () => {
    const next = setStatus(EMPTY_LIBRARY, movie, 'watched');
    expect(findItem(next, movie)?.watchedAt).toBe(NOW);
  });

  it('repeating the same status only updates updatedAt', () => {
    const first = setStatus(EMPTY_LIBRARY, movie, 'watched');
    const again = setStatus(first, movie, 'watched', LATER);
    expect(again.items).toHaveLength(1);
    expect(findItem(again, movie)).toMatchObject({ addedAt: NOW, updatedAt: LATER, watchedAt: NOW });
  });

  it('rejects watching for a movie', () => {
    expect(() => setStatus(EMPTY_LIBRARY, movie, 'watching')).toThrow('watching is only for series');
  });

  it('accepts watching for a series', () => {
    const next = setStatus(EMPTY_LIBRARY, tv, 'watching');
    expect(findItem(next, tv)).toMatchObject({ status: 'watching', watchedAt: null });
  });

  it('moving from watched back to want clears watchedAt', () => {
    const watched = setStatus(EMPTY_LIBRARY, movie, 'watched');
    const want = setStatus(watched, movie, 'want', LATER);
    expect(findItem(want, movie)).toMatchObject({ status: 'want', watchedAt: null, addedAt: NOW });
  });
});

describe('remove', () => {
  it('deletes the item and, for a series, its episode marks; keeps the rating', () => {
    let state = setStatus(EMPTY_LIBRARY, tv, 'watching');
    state = {
      ...state,
      episodes: [
        { tvId: 1399, seasonNumber: 1, episodeNumber: 1, watchedAt: NOW },
        { tvId: 1, seasonNumber: 1, episodeNumber: 1, watchedAt: NOW },
      ],
      ratings: [{ ...tv, score: 9, ratedAt: NOW, updatedAt: NOW }],
    };
    const next = applyCommand(state, { type: 'remove', ref: tv }, LATER);
    expect(findItem(next, tv)).toBeUndefined();
    expect(next.episodes).toEqual([{ tvId: 1, seasonNumber: 1, episodeNumber: 1, watchedAt: NOW }]);
    expect(findRating(next, tv)?.score).toBe(9);
  });
});

describe('rate', () => {
  const rate = (state: LibraryState, ref: TitleRef, score: number, now = NOW) =>
    applyCommand(state, { type: 'rate', ref, score, snapshot }, now);

  it('creates a watched item when rating a movie without an item', () => {
    const next = rate(EMPTY_LIBRARY, movie, 8);
    expect(findItem(next, movie)).toMatchObject({ status: 'watched', watchedAt: NOW });
    expect(findRating(next, movie)).toEqual({ ...movie, score: 8, ratedAt: NOW, updatedAt: NOW });
  });

  it('moves a want movie to watched', () => {
    const next = rate(setStatus(EMPTY_LIBRARY, movie, 'want'), movie, 7, LATER);
    expect(findItem(next, movie)).toMatchObject({ status: 'watched', watchedAt: LATER });
  });

  it('does not create an item or change status for a series', () => {
    const none = rate(EMPTY_LIBRARY, tv, 6);
    expect(none.items).toEqual([]);
    expect(findRating(none, tv)?.score).toBe(6);
    const watching = rate(setStatus(EMPTY_LIBRARY, tv, 'watching'), tv, 6, LATER);
    expect(findItem(watching, tv)?.status).toBe('watching');
  });

  it.each([0, 11, 5.5, Number.NaN])('rejects score %s', (score) => {
    expect(() => rate(EMPTY_LIBRARY, movie, score)).toThrow();
  });

  it('re-rating updates score and updatedAt but keeps ratedAt', () => {
    const next = rate(rate(EMPTY_LIBRARY, movie, 5), movie, 9, LATER);
    expect(next.ratings).toHaveLength(1);
    expect(findRating(next, movie)).toMatchObject({ score: 9, ratedAt: NOW, updatedAt: LATER });
  });
});

describe('unrate', () => {
  it('removes only the rating', () => {
    const rated = applyCommand(EMPTY_LIBRARY, { type: 'rate', ref: movie, score: 8, snapshot }, NOW);
    const next = applyCommand(rated, { type: 'unrate', ref: movie }, LATER);
    expect(next.ratings).toEqual([]);
    expect(findItem(next, movie)?.status).toBe('watched');
  });
});

describe('purity', () => {
  it('never mutates a deeply frozen input state', () => {
    const base = deepFreeze(setStatus(EMPTY_LIBRARY, movie, 'want'));
    expect(() => {
      setStatus(base, movie, 'watched', LATER);
      setStatus(base, tv, 'watching', LATER);
      applyCommand(base, { type: 'rate', ref: movie, score: 9, snapshot }, LATER);
      applyCommand(base, { type: 'remove', ref: movie }, LATER);
      applyCommand(base, { type: 'unrate', ref: movie }, LATER);
    }).not.toThrow();
  });
});

describe('restore', () => {
  const mark = { tvId: 1399, seasonNumber: 1, episodeNumber: 1, watchedAt: NOW };
  const rating = { ...tv, score: 7, ratedAt: NOW, updatedAt: NOW };
  const item = { ...tv, status: 'watching' as const, addedAt: NOW, updatedAt: NOW, watchedAt: null, snapshot };

  it('replaces item, rating and marks for the ref and leaves others alone', () => {
    const other = setStatus(EMPTY_LIBRARY, movie, 'want');
    const next = applyCommand(other, { type: 'restore', ref: tv, item, rating, marks: [mark] }, LATER);
    expect(next.items).toHaveLength(2);
    expect(findItem(next, tv)).toEqual(item);
    expect(findRating(next, tv)).toEqual(rating);
    expect(next.episodes).toEqual([mark]);
  });

  it('removes item, rating and marks when given null and []', () => {
    const full = applyCommand(EMPTY_LIBRARY, { type: 'restore', ref: tv, item, rating, marks: [mark] }, NOW);
    const next = applyCommand(full, { type: 'restore', ref: tv, item: null, rating: null, marks: [] }, LATER);
    expect(next).toEqual(EMPTY_LIBRARY);
  });

  it('replaces existing values instead of duplicating', () => {
    const full = applyCommand(EMPTY_LIBRARY, { type: 'restore', ref: tv, item, rating, marks: [mark] }, NOW);
    const changed = { ...item, status: 'want' as const };
    const next = applyCommand(full, { type: 'restore', ref: tv, item: changed, rating: null, marks: [] }, LATER);
    expect(next.items).toEqual([changed]);
    expect(next.ratings).toEqual([]);
    expect(next.episodes).toEqual([]);
  });

  it('ignores expected locally (only the server checks it)', () => {
    const full = applyCommand(EMPTY_LIBRARY, { type: 'restore', ref: tv, item, rating, marks: [mark] }, NOW);
    const changed = { ...item, status: 'want' as const };
    const command: LibraryCommand = { type: 'restore', ref: tv, item: changed, rating: null, marks: [] };
    const checked = applyCommand(full, { ...command, expected: { itemUpdatedAt: null, ratingUpdatedAt: null, markCount: 9, latestMarkAt: null } }, LATER);
    expect(checked).toEqual(applyCommand(full, command, LATER));
  });
});
