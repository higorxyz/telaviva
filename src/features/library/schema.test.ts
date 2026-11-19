import { describe, expect, it } from 'vitest';
import { parseLibraryState } from './schema';
import type { LibraryState } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const snapshot = { title: 'Clube da Luta', posterPath: null, releaseDate: '1999-10-15', genreIds: [18] };
const valid: LibraryState = {
  version: 1,
  items: [
    { mediaType: 'movie', tmdbId: 550, status: 'watched', addedAt: NOW, updatedAt: NOW, watchedAt: NOW, snapshot },
    { mediaType: 'tv', tmdbId: 1399, status: 'watching', addedAt: NOW, updatedAt: NOW, watchedAt: null, snapshot },
  ],
  episodes: [{ tvId: 1399, seasonNumber: 1, episodeNumber: 1, watchedAt: NOW }],
  ratings: [{ mediaType: 'movie', tmdbId: 550, score: 10, ratedAt: NOW, updatedAt: NOW }],
};

describe('parseLibraryState', () => {
  it('accepts a valid state', () => {
    expect(parseLibraryState(valid)).toEqual(valid);
  });

  it('rejects another version', () => {
    expect(parseLibraryState({ ...valid, version: 2 })).toBeNull();
  });

  it.each([11, 0, 7.5])('rejects score %s', (score) => {
    expect(parseLibraryState({ ...valid, ratings: [{ ...valid.ratings[0], score }] })).toBeNull();
  });

  it('rejects watching on a movie', () => {
    const items = [{ ...valid.items[0], status: 'watching' }];
    expect(parseLibraryState({ ...valid, items })).toBeNull();
  });

  it('rejects an item without snapshot.title', () => {
    const items = [{ ...valid.items[0], snapshot: { ...snapshot, title: undefined } }];
    expect(parseLibraryState({ ...valid, items })).toBeNull();
  });

  it('rejects a non-ISO date', () => {
    const items = [{ ...valid.items[0], addedAt: 'yesterday' }];
    expect(parseLibraryState({ ...valid, items })).toBeNull();
  });

  it.each(['not json', 42, null, undefined, []])('returns null for %j', (raw) => {
    expect(parseLibraryState(raw)).toBeNull();
  });
});
