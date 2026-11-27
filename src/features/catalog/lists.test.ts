import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import trendingTv from '@/test/fixtures/trending-tv-week.json';
import { onlyEvenAvailableInBr } from '@/test/providers';
import { server } from '@/test/server';
import { CATALOG_LISTS } from './lists';

const BASE = 'https://api.themoviedb.org/3';

describe('CATALOG_LISTS and availability in Brazil', () => {
  it('post-filters exactly the lists that do not come from discover', () => {
    const postFiltered = Object.entries(CATALOG_LISTS)
      .filter(([, list]) => list.postFiltered)
      .map(([id]) => id)
      .sort();
    expect(postFiltered).toEqual([
      'filmes/em-alta',
      'filmes/populares',
      'series/em-alta',
      'series/em-exibicao',
      'series/no-ar-hoje',
      'series/populares',
    ]);
  });

  it('a post-filtered list skips a page with no available title and says which page it used', async () => {
    onlyEvenAvailableInBr();
    const asked: string[] = [];
    // Page 1 holds only odd (unavailable) ids; page 2 is the fixture with its even ids.
    server.use(
      http.get(`${BASE}/trending/tv/week`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        asked.push(page);
        const results = page === '1' ? trendingTv.results.filter((r) => r.id % 2 === 1) : trendingTv.results;
        return HttpResponse.json({ ...trendingTv, page: Number(page), results });
      }),
    );
    const result = await CATALOG_LISTS['series/em-alta'].fetch(1);
    expect(asked).toEqual(['1', '2']);
    expect(result.page).toBe(2);
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.every((r) => r.id % 2 === 0)).toBe(true);
  });

  it('the hub rail of a post-filtered list tops up from the next page when short', async () => {
    onlyEvenAvailableInBr();
    const asked: string[] = [];
    server.use(
      http.get(`${BASE}/trending/tv/week`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        asked.push(page);
        const results = trendingTv.results.map((r) => ({ ...r, id: r.id + (page === '1' ? 0 : 1_000_000) }));
        return HttpResponse.json({ ...trendingTv, page: Number(page), results });
      }),
    );
    const rail = await CATALOG_LISTS['series/em-alta'].fetchRail();
    expect(asked).toEqual(['1', '2']);
    expect(rail.results.some((r) => r.id > 1_000_000)).toBe(true);
    expect(rail.results.every((r) => r.id % 2 === 0)).toBe(true);
  });
});
