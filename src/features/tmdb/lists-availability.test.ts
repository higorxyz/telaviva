import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import discoverMovies from '@/test/fixtures/discover-movie-popular.json';
import searchMatrix from '@/test/fixtures/search-multi-matrix.json';
import trendingAll from '@/test/fixtures/trending-all-day.json';
import tvAiringToday from '@/test/fixtures/tv-airing-today.json';
import trendingTv from '@/test/fixtures/trending-tv-week.json';
import { nothingAvailableInBr, onlyEvenAvailableInBr } from '@/test/providers';
import { server } from '@/test/server';
import { getMovieList, getTrending } from './movies';
import { searchMulti } from './search';
import { getTvList } from './tv';

const BASE = 'https://api.themoviedb.org/3';

function respond(path: string, body: unknown) {
  const captured: { url?: URL } = {};
  server.use(
    http.get(`${BASE}/${path}`, ({ request }) => {
      captured.url = new URL(request.url);
      return HttpResponse.json(body as Record<string, unknown>);
    }),
  );
  return captured;
}

describe('listas de discover: disponibilidade no Brasil pedida ao TMDb', () => {
  it('as listas de discover do feed pedem só títulos disponíveis no Brasil', async () => {
    for (const list of ['top_rated', 'hidden_gems', 'short', 'blockbusters'] as const) {
      const req = respond('discover/movie', discoverMovies);
      await getMovieList(list, 1);
      expect(req.url!.searchParams.get('watch_region')).toBe('BR');
      expect(req.url!.searchParams.get('with_watch_monetization_types')).toBe('flatrate|free|ads|rent|buy');
    }
  });

  it('now_playing e upcoming ficam fora do filtro de disponibilidade', async () => {
    for (const list of ['now_playing', 'upcoming'] as const) {
      const req = respond('discover/movie', discoverMovies);
      await getMovieList(list, 1);
      expect(req.url!.searchParams.has('watch_region')).toBe(false);
      expect(req.url!.searchParams.has('with_watch_monetization_types')).toBe(false);
    }
  });
});

describe('listas sem discover: pós-filtro de disponibilidade no Brasil', () => {
  const ids = (page: { results: { id: number }[] }) => page.results.map((r) => r.id);
  const evens = (body: { results: { id: number }[] }) => body.results.map((r) => r.id).filter((id) => id % 2 === 0);

  it('trending mantém só os disponíveis, na ordem original', async () => {
    onlyEvenAvailableInBr();
    respond('trending/all/day', trendingAll);
    const page = await getTrending('all', 'day', 1);
    expect(page.results.length).toBeGreaterThan(0);
    expect(ids(page)).toEqual(evens(trendingAll));
    expect(page.page).toBe(1);
    expect(page.totalPages).toBe(trendingAll.total_pages);
  });

  it('popular, on_the_air e airing_today também filtram', async () => {
    onlyEvenAvailableInBr();
    respond('movie/popular', discoverMovies);
    respond('tv/on_the_air', trendingTv);
    respond('tv/airing_today', tvAiringToday);
    const popular = await getMovieList('popular', 1);
    expect(popular.results.length).toBeGreaterThan(0);
    expect(popular.results.every((r) => r.id % 2 === 0)).toBe(true);
    expect(ids(await getTvList('on_the_air', 1))).toEqual(evens(trendingTv));
    expect(ids(await getTvList('airing_today', 1))).toEqual(evens(tvAiringToday));
  });

  it('a busca por nome não filtra: um título indisponível continua aparecendo', async () => {
    const asked = nothingAvailableInBr();
    respond('search/multi', searchMatrix);
    const page = await searchMulti('matrix', 1);
    expect(page.results.some((r) => r.mediaType === 'movie' && r.id === 603)).toBe(true);
    expect(asked).toEqual([]);
  });
});
