import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '../tmdb/types';
import { pickSeeds, scoreRecommendations, type Seed } from './recommend';
import { EMPTY_LIBRARY, type LibraryItem, type LibraryState, type Rating } from './types';

const media = (id: number, extra: Partial<MediaSummary> = {}): MediaSummary => ({
  id,
  mediaType: 'movie',
  title: `T${id}`,
  originalTitle: `T${id}`,
  overview: '',
  posterPath: null,
  backdropPath: null,
  voteAverage: 7,
  voteCount: 100,
  popularity: 50,
  releaseDate: null,
  genreIds: [],
  originalLanguage: 'en',
  ...extra,
});
const seed = (tmdbId: number, weight: number, genreIds: number[] = []): Seed => ({
  mediaType: 'movie',
  tmdbId,
  weight,
  genreIds,
});
const lists = (o: Record<string, MediaSummary[]>) => new Map(Object.entries(o));
const ids = (r: MediaSummary[]) => r.map((m) => m.id);

describe('scoreRecommendations', () => {
  it('ranks a candidate from a 9-rated seed above one from an unrated seed', () => {
    const out = scoreRecommendations(
      [seed(1, 2), seed(2, 1)],
      lists({ 'movie:1': [media(10)], 'movie:2': [media(20)] }),
      new Set(),
    );
    expect(ids(out)).toEqual([10, 20]);
  });

  it('drops a candidate recommended only by a low-rated seed', () => {
    const out = scoreRecommendations([seed(1, -1.5)], lists({ 'movie:1': [media(10)] }), new Set());
    expect(out).toEqual([]);
  });

  it('lowers a candidate that a disliked seed also recommends', () => {
    const out = scoreRecommendations(
      [seed(1, 2), seed(2, -1.5)],
      lists({ 'movie:1': [media(10), media(20)], 'movie:2': [media(10)] }),
      new Set(),
    );
    expect(ids(out)).toEqual([20, 10]);
  });

  it('raises a candidate that appears in two lists', () => {
    const out = scoreRecommendations(
      [seed(1, 1), seed(2, 1)],
      lists({ 'movie:1': [media(10), media(20)], 'movie:2': [media(20)] }),
      new Set(),
    );
    expect(ids(out)).toEqual([20, 10]);
  });

  it('never returns excluded keys or seeds', () => {
    const out = scoreRecommendations(
      [seed(1, 2), seed(2, 1)],
      lists({ 'movie:1': [media(2), media(10), media(11)], 'movie:2': [media(1)] }),
      new Set(['movie:10']),
    );
    expect(ids(out)).toEqual([11]);
  });

  it('uses genre affinity from positive seeds only and returns at most 20', () => {
    const out = scoreRecommendations(
      [seed(1, 1, [18]), seed(2, 1, [18])],
      lists({ 'movie:1': [media(10, { genreIds: [18] }), media(11, { genreIds: [99] })] }),
      new Set(),
    );
    expect(ids(out)).toEqual([10, 11]);
    const many = Array.from({ length: 30 }, (_, i) => media(100 + i));
    expect(scoreRecommendations([seed(1, 1)], lists({ 'movie:1': many }), new Set())).toHaveLength(20);
  });

  it('caps the positive frequency at 40', () => {
    const seeds = Array.from({ length: 8 }, (_, i) => seed(i + 1, 2));
    const all = Object.fromEntries(seeds.map((s) => [`movie:${s.tmdbId}`, [media(10, { voteAverage: 0, popularity: 0 }), media(11, { voteAverage: 10, popularity: 0 })]]));
    // 10 appears in 8 lists (80 raw, capped to 40); 11 too, but its vote adds 20.
    expect(ids(scoreRecommendations(seeds, lists(all), new Set()))).toEqual([11, 10]);
  });
});

const item = (id: number, status: LibraryItem['status'], updatedAt: string, mediaType: 'movie' | 'tv' = 'movie'): LibraryItem => ({
  mediaType,
  tmdbId: id,
  status,
  addedAt: updatedAt,
  updatedAt,
  watchedAt: null,
  snapshot: { title: 'x', posterPath: null, releaseDate: null, genreIds: [id] },
});
const rating = (id: number, score: number, mediaType: 'movie' | 'tv' = 'movie', updatedAt = '2026-01-01T00:00:00.000Z'): Rating => ({
  mediaType,
  tmdbId: id,
  score,
  ratedAt: updatedAt,
  updatedAt,
});
const lib = (items: LibraryItem[], ratings: Rating[] = []): LibraryState => ({ ...EMPTY_LIBRARY, items, ratings });

describe('pickSeeds', () => {
  it('maps ratings and status to weights', () => {
    const seeds = pickSeeds(
      lib(
        [
          item(1, 'watched', '2026-01-01'),
          item(2, 'watched', '2026-01-01'),
          item(3, 'watched', '2026-01-01'),
          item(4, 'watched', '2026-01-01'),
          item(5, 'want', '2026-01-01'),
          item(6, 'watching', '2026-01-01', 'tv'),
        ],
        [rating(1, 10), rating(2, 5), rating(3, 4)],
      ),
    );
    const w = Object.fromEntries(seeds.map((s) => [`${s.mediaType}:${s.tmdbId}`, s.weight]));
    expect(w).toEqual({ 'movie:1': 2, 'movie:2': 1, 'movie:3': -1.5, 'movie:4': 1, 'movie:5': 0.5, 'tv:6': 1 });
    expect(seeds.find((s) => s.tmdbId === 1)?.genreIds).toEqual([1]);
  });

  it('keeps 8 positive and 4 negative seeds, by weight then recency', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      item(i + 1, 'watched', `2026-01-${String(i + 1).padStart(2, '0')}`),
    );
    const neg = Array.from({ length: 6 }, (_, i) =>
      item(100 + i, 'watched', `2026-02-${String(i + 1).padStart(2, '0')}`),
    );
    const ratings = [...neg.map((n) => rating(n.tmdbId, 2)), rating(1, 9)];
    const seeds = pickSeeds(lib([...items, ...neg], ratings));
    const positive = seeds.filter((s) => s.weight > 0).map((s) => s.tmdbId);
    // 1 has weight 2; the rest (weight 1) fill by most recent updatedAt: 12..6.
    expect(positive).toEqual([1, 12, 11, 10, 9, 8, 7, 6]);
    expect(seeds.filter((s) => s.weight < 0).map((s) => s.tmdbId)).toEqual([105, 104, 103, 102]);
  });

  it('makes a series rated 9 with no item a positive seed without genres', () => {
    expect(pickSeeds(lib([], [rating(7, 9, 'tv')]))).toEqual([{ mediaType: 'tv', tmdbId: 7, weight: 2, genreIds: [] }]);
  });

  it('makes a series rated 2 with no item a negative seed', () => {
    expect(pickSeeds(lib([], [rating(7, 2, 'tv')]))).toEqual([{ mediaType: 'tv', tmdbId: 7, weight: -1.5, genreIds: [] }]);
  });

  it('applies the limits across item and rating-only seeds', () => {
    const items = [item(1, 'watched', '2026-01-01'), item(2, 'watched', '2026-01-02')];
    const rated = Array.from({ length: 10 }, (_, i) => rating(200 + i, 6, 'tv', `2026-03-${String(i + 1).padStart(2, '0')}`));
    const neg = Array.from({ length: 5 }, (_, i) => rating(300 + i, 1, 'tv', `2026-04-${String(i + 1).padStart(2, '0')}`));
    const seeds = pickSeeds(lib(items, [...rated, ...neg]));
    expect(seeds.filter((s) => s.weight > 0).map((s) => s.tmdbId)).toEqual([209, 208, 207, 206, 205, 204, 203, 202]);
    expect(seeds.filter((s) => s.weight < 0).map((s) => s.tmdbId)).toEqual([304, 303, 302, 301]);
  });
});
