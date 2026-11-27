import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '../tmdb/types';
import { isValidLibraryState } from './schema';
import { toSnapshot, trimSnapshot } from './snapshot';
import { EMPTY_LIBRARY } from './types';

describe('toSnapshot', () => {
  it('copies only the four snapshot fields', () => {
    const full: MediaSummary = {
      id: 1,
      mediaType: 'movie',
      title: 'Clube da Luta',
      originalTitle: 'Fight Club',
      overview: 'x',
      posterPath: '/p.jpg',
      backdropPath: null,
      voteAverage: 8,
      voteCount: 1,
      popularity: 1,
      releaseDate: '1999-10-15',
      genreIds: [18],
      originalLanguage: 'en',
    };
    expect(toSnapshot(full)).toEqual({
      title: 'Clube da Luta',
      posterPath: '/p.jpg',
      releaseDate: '1999-10-15',
      genreIds: [18],
    });
  });

  it.each(['', '   '])('names a title without a name "Sem título" (%j)', (title) => {
    expect(toSnapshot({ title, posterPath: null, releaseDate: null, genreIds: [] }).title).toBe('Sem título');
  });

  it('does not share the genreIds array', () => {
    const genreIds = [18];
    expect(toSnapshot({ title: 'a', posterPath: null, releaseDate: null, genreIds }).genreIds).not.toBe(genreIds);
  });

  it('trims what TMDb sends to the saved limits, so a real title is never refused', () => {
    const long = toSnapshot({
      title: 'T'.repeat(500),
      posterPath: `/${'p'.repeat(300)}`,
      releaseDate: '1999-10-15T00:00:00Z',
      genreIds: [0, -1, 1.5, 2 ** 31, ...Array.from({ length: 30 }, (_, i) => i + 1)],
    });
    expect(long.title).toHaveLength(300);
    expect(long.posterPath).toBeNull();
    expect(long.releaseDate).toBe('1999-10-15');
    expect(long.genreIds).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(isValidLibraryState({ ...EMPTY_LIBRARY, items: [{ ...item, snapshot: long }] })).toBe(true);
  });

  it('never cuts an emoji in half', () => {
    const title = `${'a'.repeat(299)}🎬`;
    expect(toSnapshot({ title, posterPath: null, releaseDate: null, genreIds: [] }).title).toBe('a'.repeat(299));
  });
});

describe('trimSnapshot', () => {
  it('leaves a snapshot within limits as it is, empty strings included', () => {
    const s = { title: '', posterPath: '', releaseDate: '', genreIds: [18] };
    expect(trimSnapshot(s)).toEqual(s);
  });
});

const item = {
  mediaType: 'movie' as const,
  tmdbId: 1,
  status: 'want' as const,
  addedAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z',
  watchedAt: null,
};
