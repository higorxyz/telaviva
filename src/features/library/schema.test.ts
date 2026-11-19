import { describe, expect, it } from 'vitest';
import { normalizeLibraryState, parseLibraryState } from './schema';
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

describe('normalizeLibraryState', () => {
  const LATER = '2026-11-20T12:00:00.000Z';

  it('keeps the latest updatedAt for duplicated items and ratings', () => {
    const state: LibraryState = {
      version: 1,
      items: [
        { ...valid.items[0], status: 'want', watchedAt: null, updatedAt: NOW },
        { ...valid.items[0], status: 'watched', updatedAt: LATER },
        { ...valid.items[0], status: 'want', watchedAt: null, updatedAt: NOW },
      ],
      episodes: [],
      ratings: [
        { ...valid.ratings[0], score: 3, updatedAt: LATER },
        { ...valid.ratings[0], score: 9, updatedAt: NOW },
      ],
    };
    const out = normalizeLibraryState(state);
    expect(out.items).toHaveLength(1);
    expect(out.items[0].status).toBe('watched');
    expect(out.ratings).toEqual([{ ...valid.ratings[0], score: 3, updatedAt: LATER }]);
  });

  it('keeps the latest watchedAt for duplicated episode marks', () => {
    const mark = valid.episodes[0];
    const out = normalizeLibraryState({
      ...valid,
      episodes: [
        { ...mark, watchedAt: NOW },
        { ...mark, watchedAt: LATER },
        { ...mark, episodeNumber: 2 },
      ],
    });
    expect(out.episodes).toHaveLength(2);
    expect(out.episodes.find((e) => e.episodeNumber === 1)?.watchedAt).toBe(LATER);
  });

  it('treats movie and tv with the same id as different titles', () => {
    const out = normalizeLibraryState({
      ...valid,
      items: [valid.items[0], { ...valid.items[1], tmdbId: 550 }],
    });
    expect(out.items).toHaveLength(2);
  });

  it('returns an equal state when there are no duplicates', () => {
    expect(normalizeLibraryState(valid)).toEqual(valid);
  });
});
