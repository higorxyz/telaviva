import { describe, expect, it } from 'vitest';
import { EMPTY_LIBRARY, type LibraryState } from '@/features/library/types';
import { diffStates, isEmptyDiff } from './diff';

const T0 = '2026-11-01T00:00:00.000Z';
const T1 = '2026-11-02T00:00:00.000Z';
const snapshot = { title: 'Filme', posterPath: null, releaseDate: null, genreIds: [18] };
const item = (tmdbId: number, over: Record<string, unknown> = {}) => ({
  mediaType: 'movie' as const,
  tmdbId,
  status: 'want' as const,
  addedAt: T0,
  updatedAt: T0,
  watchedAt: null,
  snapshot,
  ...over,
});
const rating = (tmdbId: number, score = 7) => ({ mediaType: 'movie' as const, tmdbId, score, ratedAt: T0, updatedAt: T0 });
const mark = (episodeNumber: number, watchedAt = T0) => ({ tvId: 9, seasonNumber: 1, episodeNumber, watchedAt });

const state = (over: Partial<LibraryState>): LibraryState => ({ ...EMPTY_LIBRARY, ...over });

describe('diffStates', () => {
  it('is empty for equal states, even with rows in another order', () => {
    const a = state({ items: [item(1), item(2)], ratings: [rating(1)], episodes: [mark(1), mark(2)] });
    const b = state({ items: [item(2), item(1)], ratings: [rating(1)], episodes: [mark(2), mark(1)] });
    const diff = diffStates(a, b);
    expect(isEmptyDiff(diff)).toBe(true);
  });

  it('upserts new and changed items and deletes missing ones, by key', () => {
    const before = state({ items: [item(1), item(2), item(3)] });
    const after = state({ items: [item(1), item(2, { status: 'watched', updatedAt: T1, watchedAt: T1 }), item(4)] });
    expect(diffStates(before, after)).toMatchObject({
      upsertItems: [after.items[1], after.items[2]],
      deleteItems: [{ mediaType: 'movie', tmdbId: 3 }],
    });
  });

  it('sees a change inside the snapshot (title, poster, genres)', () => {
    const before = state({ items: [item(1)] });
    for (const changed of [
      { ...snapshot, title: 'Outro' },
      { ...snapshot, posterPath: '/p.jpg' },
      { ...snapshot, genreIds: [18, 35] },
    ]) {
      expect(diffStates(before, state({ items: [item(1, { snapshot: changed })] })).upsertItems).toHaveLength(1);
    }
  });

  it('keeps a movie and a series with the same id apart', () => {
    const before = state({ items: [item(1)] });
    const after = state({ items: [item(1), item(1, { mediaType: 'tv' })] });
    expect(diffStates(before, after)).toMatchObject({ upsertItems: [after.items[1]], deleteItems: [] });
  });

  it('upserts and deletes ratings', () => {
    const before = state({ ratings: [rating(1), rating(2)] });
    const after = state({ ratings: [rating(1, 9), rating(3)] });
    expect(diffStates(before, after)).toMatchObject({
      upsertRatings: [rating(1, 9), rating(3)],
      deleteRatings: [{ mediaType: 'movie', tmdbId: 2 }],
    });
  });

  it('upserts and deletes episode marks by series, season and episode', () => {
    const before = state({ episodes: [mark(1), mark(2), mark(3)] });
    const after = state({ episodes: [mark(1), mark(2, T1), mark(4)] });
    expect(diffStates(before, after)).toMatchObject({
      upsertMarks: [mark(2, T1), mark(4)],
      deleteMarks: [{ tvId: 9, seasonNumber: 1, episodeNumber: 3 }],
    });
  });

  it('does not touch rows of other tables', () => {
    const before = state({ items: [item(1)], ratings: [rating(1)], episodes: [mark(1)] });
    const diff = diffStates(before, state({ ...before, ratings: [] }));
    expect(diff).toEqual({
      upsertItems: [],
      deleteItems: [],
      upsertRatings: [],
      deleteRatings: [{ mediaType: 'movie', tmdbId: 1 }],
      upsertMarks: [],
      deleteMarks: [],
    });
    expect(isEmptyDiff(diff)).toBe(false);
  });
});
