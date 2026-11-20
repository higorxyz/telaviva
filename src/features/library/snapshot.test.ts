import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '../tmdb/types';
import { toSnapshot } from './snapshot';

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
});
