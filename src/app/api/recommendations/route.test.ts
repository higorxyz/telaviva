import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import moviePage from '@/test/fixtures/discover-movie-page-2.json';
import trendingAll from '@/test/fixtures/trending-all-day.json';
import { onlyEvenAvailableInBr } from '@/test/providers';
import { server } from '@/test/server';
import { POST } from './route';

const BASE = 'https://api.themoviedb.org/3';
const call = (body: unknown, raw = false) =>
  POST(
    new Request('http://localhost/api/recommendations', {
      method: 'POST',
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );
const seed = (tmdbId: number, weight = 2) => ({ mediaType: 'movie', tmdbId, weight, genreIds: [18] });
const fail = () => HttpResponse.json({ status_message: 'boom' }, { status: 500 });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/recommendations', () => {
  it('502 when every recommendation call and the trending fallback fail', async () => {
    server.use(
      http.get(`${BASE}/movie/7001/recommendations`, fail),
      http.get(`${BASE}/trending/all/week`, fail),
    );
    expect((await call({ seeds: [seed(7001)], exclude: [] })).status).toBe(502);
  });

  it('200 with trending padding when only the recommendation calls fail', async () => {
    server.use(
      http.get(`${BASE}/movie/7002/recommendations`, fail),
      http.get(`${BASE}/trending/all/week`, () => HttpResponse.json(trendingAll)),
    );
    const res = await call({ seeds: [seed(7002)], exclude: [] });
    expect(res.status).toBe(200);
    const { results } = (await res.json()) as { results: unknown[] };
    expect(results).toHaveLength(10);
  });

  it('returns scored results and pads with trending, skipping excluded titles and duplicates', async () => {
    server.use(
      http.get(`${BASE}/movie/7003/recommendations`, () =>
        HttpResponse.json({ ...moviePage, results: moviePage.results.slice(0, 3) }),
      ),
      http.get(`${BASE}/trending/all/week`, () => HttpResponse.json(trendingAll)),
    );
    const excluded = `movie:${(trendingAll.results[0] as { id: number }).id}`;
    const res = await call({ seeds: [seed(7003)], exclude: [excluded, 'tv:1'] });
    const { results } = (await res.json()) as { results: { id: number; mediaType: string }[] };
    expect(results).toHaveLength(10);
    const keys = results.map((r) => `${r.mediaType}:${r.id}`);
    expect(new Set(keys).size).toBe(10);
    expect(keys).not.toContain(excluded);
    expect(keys.slice(0, 3).every((k) => k.startsWith('movie:'))).toBe(true);
  });

  it('does not call trending when there are already 10 results', async () => {
    let trendingCalls = 0;
    server.use(
      http.get(`${BASE}/movie/7004/recommendations`, () => HttpResponse.json(moviePage)),
      http.get(`${BASE}/trending/all/week`, () => {
        trendingCalls += 1;
        return HttpResponse.json(trendingAll);
      }),
    );
    const res = await call({ seeds: [seed(7004)], exclude: [] });
    const { results } = (await res.json()) as { results: unknown[] };
    expect(results.length).toBeGreaterThanOrEqual(10);
    expect(trendingCalls).toBe(0);
  });

  it('only recommends titles available in Brazil, padding included', async () => {
    onlyEvenAvailableInBr();
    server.use(
      http.get(`${BASE}/movie/7005/recommendations`, () =>
        HttpResponse.json({ ...moviePage, results: moviePage.results.slice(0, 6) }),
      ),
      http.get(`${BASE}/trending/all/week`, () => HttpResponse.json(trendingAll)),
    );
    const res = await call({ seeds: [seed(7005)], exclude: [] });
    const { results } = (await res.json()) as { results: { id: number }[] };
    const evenRecs = moviePage.results.slice(0, 6).filter((r) => r.id % 2 === 0);
    expect(evenRecs.length).toBeGreaterThan(0);
    expect(results.length).toBeGreaterThan(evenRecs.length); // the padding still contributes
    expect(results.every((r) => r.id % 2 === 0)).toBe(true);
  });

  it.each([
    ['not json', '{oops', true],
    ['no seeds', { seeds: [], exclude: [] }, false],
    ['13 seeds', { seeds: Array.from({ length: 13 }, (_, i) => seed(i + 1)), exclude: [] }, false],
    ['501 exclude keys', { seeds: [seed(1)], exclude: Array.from({ length: 501 }, (_, i) => `movie:${i}`) }, false],
    ['bad exclude key', { seeds: [seed(1)], exclude: ['person:1'] }, false],
    ['bad media type', { seeds: [{ ...seed(1), mediaType: 'person' }], exclude: [] }, false],
    ['non-integer id', { seeds: [{ ...seed(1), tmdbId: 1.5 }], exclude: [] }, false],
    ['zero id', { seeds: [{ ...seed(1), tmdbId: 0 }], exclude: [] }, false],
    ['21 genres', { seeds: [{ ...seed(1), genreIds: Array.from({ length: 21 }, (_, i) => i) }], exclude: [] }, false],
    ['missing weight', { seeds: [{ mediaType: 'movie', tmdbId: 1, genreIds: [] }], exclude: [] }, false],
  ])('400 for %s', async (_name, body, raw) => {
    expect((await call(body, raw)).status).toBe(400);
  });
});
