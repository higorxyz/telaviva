import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import discoverMovies from '@/test/fixtures/discover-movie-popular.json';
import genreMovies from '@/test/fixtures/genre-movie-list.json';
import searchMatrix from '@/test/fixtures/search-multi-matrix.json';
import trendingAll from '@/test/fixtures/trending-all-day.json';
import trendingTv from '@/test/fixtures/trending-tv-week.json';
import providers from '@/test/fixtures/watch-providers-movie-br.json';
import { server } from '@/test/server';
import { discover } from './discover';
import { getGenres, getWatchProviderCatalog } from './genres';
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

describe('getMovieList', () => {
  // 2026-11-18T01:30Z = 2026-11-17 22:30 em Sao Paulo: UTC e Sao Paulo divergem.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T01:30:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('now_playing: janela -120/+14 dias, votos >= 40, região BR, sem adultos', async () => {
    const req = respond('discover/movie', discoverMovies);
    await getMovieList('now_playing', 1);
    const p = req.url!.searchParams;
    expect(p.get('release_date.gte')).toBe('2026-07-20');
    expect(p.get('release_date.lte')).toBe('2026-12-01');
    expect(p.get('vote_count.gte')).toBe('40');
    expect(p.get('region')).toBe('BR');
    expect(p.get('include_adult')).toBe('false');
  });

  it('upcoming: +1 a +450 dias com lançamento tipo 2|3', async () => {
    const req = respond('discover/movie', discoverMovies);
    await getMovieList('upcoming', 1);
    const p = req.url!.searchParams;
    expect(p.get('release_date.gte')).toBe('2026-11-18');
    expect(p.get('release_date.lte')).toBe('2028-02-10');
    expect(p.get('with_release_type')).toBe('2|3');
  });

  it('top_rated, hidden_gems, short, blockbusters e streaming_br usam os filtros da v1', async () => {
    const cases: [Parameters<typeof getMovieList>[0], Record<string, string>][] = [
      ['top_rated', { 'vote_count.gte': '1200', 'vote_average.gte': '7.2' }],
      ['hidden_gems', { 'vote_average.gte': '7.2', 'vote_count.gte': '120', 'vote_count.lte': '1200' }],
      ['short', { 'with_runtime.lte': '100', 'vote_count.gte': '100', 'vote_average.gte': '6' }],
      ['blockbusters', { sort_by: 'revenue.desc', 'vote_count.gte': '1000' }],
      ['streaming_br', { watch_region: 'BR', with_watch_monetization_types: 'flatrate' }],
    ];
    for (const [list, expected] of cases) {
      const req = respond('discover/movie', discoverMovies);
      await getMovieList(list, 1);
      for (const [k, v] of Object.entries(expected)) expect(req.url!.searchParams.get(k)).toBe(v);
      expect(req.url!.searchParams.get('include_adult')).toBe('false');
    }
  });

  it('popular usa movie/popular na região BR', async () => {
    const req = respond('movie/popular', discoverMovies);
    const page = await getMovieList('popular', 1);
    expect(req.url!.searchParams.get('region')).toBe('BR');
    expect(page.results.length).toBeGreaterThan(0);
  });
});

describe('getTvList', () => {
  it('top_rated usa discover com votos >= 500 e sem adultos', async () => {
    const req = respond('discover/tv', { ...discoverMovies, results: [] });
    await getTvList('top_rated', 1);
    expect(req.url!.searchParams.get('vote_count.gte')).toBe('500');
    expect(req.url!.searchParams.get('include_adult')).toBe('false');
    expect(req.url!.searchParams.get('watch_region')).toBe('BR');
    expect(req.url!.searchParams.get('with_watch_monetization_types')).toBe('flatrate|free|ads|rent|buy');
  });

  it('on_the_air usa o endpoint homônimo', async () => {
    const req = respond('tv/on_the_air', trendingTv);
    const page = await getTvList('on_the_air', 2);
    expect(req.url!.searchParams.get('page')).toBe('2');
    expect(page.results.every((r) => r.mediaType === 'tv')).toBe(true);
  });
});

describe('getTrending', () => {
  it('all mantém apenas filmes e séries', async () => {
    const req = respond('trending/all/day', trendingAll);
    const page = await getTrending('all', 'day', 1);
    expect(page.results.length).toBeGreaterThan(0);
    expect(page.results.every((r) => r.mediaType === 'movie' || r.mediaType === 'tv')).toBe(true);
    expect(req.url!.searchParams.has('include_adult')).toBe(false);
  });

  it('tv fixa o mediaType', async () => {
    respond('trending/tv/week', trendingTv);
    const page = await getTrending('tv', 'week', 1);
    expect(page.results.every((r) => r.mediaType === 'tv')).toBe(true);
  });
});

describe('searchMulti', () => {
  it('mapeia filmes, séries e pessoas e envia include_adult=false', async () => {
    const req = respond('search/multi', searchMatrix);
    const page = await searchMulti('matrix', 1);
    expect(req.url!.searchParams.get('query')).toBe('matrix');
    expect(req.url!.searchParams.get('include_adult')).toBe('false');
    expect(page.results.some((r) => r.mediaType === 'movie')).toBe(true);
  });

  it('codifica a query e não dispara requisição para espaços', async () => {
    const req = respond('search/multi', searchMatrix);
    await searchMulti('  a&b coração ');
    expect(req.url!.searchParams.get('query')).toBe('a&b coração');
    expect(req.url!.search).toContain('a%26b');
    const empty = await searchMulti('   ');
    expect(empty.results).toEqual([]);
  });

  it('inclui pessoas quando a resposta as traz', async () => {
    respond('search/multi', {
      ...searchMatrix,
      results: [{ media_type: 'person', id: 6384, name: 'Keanu Reeves', profile_path: null, known_for_department: 'Acting' }],
    });
    const page = await searchMulti('keanu');
    expect(page.results[0]).toEqual({
      mediaType: 'person',
      id: 6384,
      name: 'Keanu Reeves',
      profilePath: null,
      knownForDepartment: 'Acting',
    });
  });
});

describe('discover / genres / providers', () => {
  it('discover repassa os params e força include_adult=false', async () => {
    const req = respond('discover/movie', discoverMovies);
    const page = await discover('movie', { with_genres: 28, sort_by: 'popularity.desc' }, 3);
    const p = req.url!.searchParams;
    expect(p.get('with_genres')).toBe('28');
    expect(p.get('page')).toBe('3');
    expect(p.get('include_adult')).toBe('false');
    expect(page.results[0]!.mediaType).toBe('movie');
  });

  it('getGenres devolve a lista de gêneros', async () => {
    respond('genre/movie/list', genreMovies);
    const genres = await getGenres('movie');
    expect(genres.find((g) => g.id === 28)).toBeDefined();
  });

  it('getWatchProviderCatalog pede a região BR', async () => {
    const req = respond('watch/providers/movie', providers);
    const list = await getWatchProviderCatalog('movie');
    expect(req.url!.searchParams.get('watch_region')).toBe('BR');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('logoPath');
  });
});

describe('filtro de adultos nas listas', () => {
  it('remove itens adult=true do discover, trending e busca', async () => {
    const first = discoverMovies.results[0]!;
    respond('discover/movie', { ...discoverMovies, results: [{ ...first, id: 9001, adult: true }, ...discoverMovies.results] });
    expect((await discover('movie', {}, 1)).results.some((r) => r.id === 9001)).toBe(false);

    const t = trendingAll.results[0]!;
    respond('trending/all/day', { ...trendingAll, results: [{ ...t, id: 9002, adult: true }, ...trendingAll.results] });
    expect((await getTrending('all', 'day', 1)).results.some((r) => r.id === 9002)).toBe(false);

    respond('search/multi', {
      ...searchMatrix,
      results: [{ media_type: 'person', id: 9003, name: 'X', adult: true }, { ...t, id: 9004, adult: true }],
    });
    expect((await searchMulti('x', 1)).results).toEqual([]);
  });
});
