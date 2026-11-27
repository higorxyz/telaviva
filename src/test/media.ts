import type { MediaSummary } from '@/features/tmdb/types';

export function media(overrides: Partial<MediaSummary> = {}): MediaSummary {
  return {
    id: 1,
    mediaType: 'movie',
    title: 'Titulo',
    originalTitle: 'Title',
    overview: 'Sinopse longa o bastante para passar.',
    posterPath: '/poster.jpg',
    backdropPath: null,
    voteAverage: 7.5,
    voteCount: 100,
    popularity: 10,
    releaseDate: '2020-05-01',
    genreIds: [],
    originalLanguage: 'en',
    ...overrides,
  };
}

export const movie = (o: Partial<MediaSummary> = {}) => media({ mediaType: 'movie', ...o });
export const tv = (o: Partial<MediaSummary> = {}) => media({ mediaType: 'tv', ...o });
