import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import moviePage from '@/test/fixtures/discover-movie-page-2.json';
import tvPage from '@/test/fixtures/discover-tv-page-2.json';
import { server } from '@/test/server';
import { getRecommendationsFor } from './recommendations';

const BASE = 'https://api.themoviedb.org/3';

describe('getRecommendationsFor', () => {
  it('maps movie results with mediaType movie and asks for page 1 in pt-BR', async () => {
    const seen: { url?: URL } = {};
    server.use(
      http.get(`${BASE}/movie/9101/recommendations`, ({ request }) => {
        seen.url = new URL(request.url);
        return HttpResponse.json(moviePage as Record<string, unknown>);
      }),
    );
    const result = await getRecommendationsFor('movie', 9101);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.mediaType === 'movie')).toBe(true);
    expect(seen.url!.searchParams.get('page')).toBe('1');
    expect(seen.url!.searchParams.get('language')).toBe('pt-BR');
  });

  it('maps tv results with mediaType tv', async () => {
    server.use(http.get(`${BASE}/tv/9102/recommendations`, () => HttpResponse.json(tvPage as Record<string, unknown>)));
    const result = await getRecommendationsFor('tv', 9102);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((r) => r.mediaType === 'tv')).toBe(true);
  });

  it('filters adult results', async () => {
    const page = { ...moviePage, results: moviePage.results.map((r, i) => (i === 0 ? { ...r, adult: true } : r)) };
    server.use(http.get(`${BASE}/movie/9103/recommendations`, () => HttpResponse.json(page as Record<string, unknown>)));
    const result = await getRecommendationsFor('movie', 9103);
    expect(result.map((r) => r.id)).not.toContain(moviePage.results[0]!.id);
    expect(result).toHaveLength(moviePage.results.length - 1);
  });

  it('turns a TMDb 404 into an empty list', async () => {
    server.use(
      http.get(`${BASE}/movie/9104/recommendations`, () => HttpResponse.json({ status_message: 'nf' }, { status: 404 })),
    );
    expect(await getRecommendationsFor('movie', 9104)).toEqual([]);
  });
});
