import { describe, expect, it, vi } from 'vitest';
import trendingAll from '@/test/fixtures/trending-all-day.json';
import trendingTv from '@/test/fixtures/trending-tv-week.json';
import { toMediaSummary, toPaginated, withOverviewFallback } from './mappers';
import { moviePageSchema, tvPageSchema } from './schemas';

const rawTv = tvPageSchema.parse(trendingTv).results[0];
const rawMovie = moviePageSchema.parse({
  ...trendingAll,
  results: trendingAll.results.filter((r) => r.media_type === 'movie'),
}).results[0];

describe('toMediaSummary', () => {
  it('mapeia série com name e first_air_date', () => {
    expect(toMediaSummary(rawTv, 'tv')).toMatchObject({
      id: rawTv.id,
      mediaType: 'tv',
      title: rawTv.name,
      originalTitle: rawTv.original_name,
      releaseDate: rawTv.first_air_date,
      posterPath: rawTv.poster_path,
      voteAverage: rawTv.vote_average,
    });
  });

  it('mapeia filme com title e release_date', () => {
    expect(toMediaSummary(rawMovie, 'movie')).toMatchObject({
      mediaType: 'movie',
      title: rawMovie.title,
      releaseDate: rawMovie.release_date,
    });
  });

  it('aceita pôster nulo e sinopse vazia', () => {
    expect(toMediaSummary({ ...rawMovie, poster_path: null, overview: '' }, 'movie')).toMatchObject({
      posterPath: null,
      overview: '',
    });
  });

  it('data vazia vira null', () => {
    expect(toMediaSummary({ ...rawMovie, release_date: '' }, 'movie').releaseDate).toBeNull();
  });
});

describe('schemas', () => {
  it('tolera campos ausentes ou nulos', () => {
    const parsed = moviePageSchema.parse({
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [{ id: 1, title: 'X', poster_path: null }],
    });
    expect(toMediaSummary(parsed.results[0], 'movie')).toMatchObject({
      overview: '',
      posterPath: null,
      backdropPath: null,
      releaseDate: null,
      genreIds: [],
    });
  });
});

describe('toPaginated', () => {
  it('converte a paginação snake_case', () => {
    const page = toPaginated(tvPageSchema.parse(trendingTv), (r) => toMediaSummary(r, 'tv'));
    expect(page.page).toBe(1);
    expect(page.totalPages).toBeGreaterThan(0);
    expect(page.results[0].mediaType).toBe('tv');
  });
});

describe('withOverviewFallback', () => {
  it('usa en-US só quando pt-BR vem vazio', async () => {
    const fb = vi.fn().mockResolvedValue({ overview: 'English' });
    expect((await withOverviewFallback({ overview: '' }, fb)).overview).toBe('English');
    expect((await withOverviewFallback({ overview: 'PT' }, fb)).overview).toBe('PT');
    expect(fb).toHaveBeenCalledTimes(1);
  });

  it('mantém o original se o fallback falhar', async () => {
    const fb = vi.fn().mockRejectedValue(new Error('down'));
    expect((await withOverviewFallback({ overview: '' }, fb)).overview).toBe('');
  });
});
