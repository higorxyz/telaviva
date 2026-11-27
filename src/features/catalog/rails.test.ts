import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import discoverMovies from '@/test/fixtures/discover-movie-popular.json';
import trendingAll from '@/test/fixtures/trending-all-day.json';
import trendingTv from '@/test/fixtures/trending-tv-week.json';
import { movie, tv } from '@/test/media';
import movie550 from '@/test/fixtures/movie-550.json';
import tv1399 from '@/test/fixtures/tv-1399.json';
import { onlyEvenAvailableInBr } from '@/test/providers';
import { server } from '@/test/server';
import { getFeatured } from '@/features/home/data';
import { buildHomeRails, dedupeRails, requireRails, type RailInput } from './rails';

const BASE = 'https://api.themoviedb.org/3';
const many = (from: number, n: number, make = movie) => Array.from({ length: n }, (_, i) => make({ id: from + i }));
const rail = (id: string, items: ReturnType<typeof movie>[]): RailInput => ({ id, title: { lead: id }, items });

describe('dedupeRails', () => {
  it('keeps a title only in the first rail', () => {
    const m1 = movie({ id: 1 });
    const out = dedupeRails([rail('a', [m1, ...many(10, 8)]), rail('b', [m1, ...many(30, 8)])], { perRail: 14 });
    expect(out[0].items.some((i) => i.id === 1)).toBe(true);
    expect(out[1].items.find((i) => i.id === 1)).toBeUndefined();
  });
  it('drops rails with fewer than 6 items', () => {
    expect(dedupeRails([rail('a', many(1, 5))], { perRail: 14 })).toHaveLength(0);
  });
  it('honours exclude and perRail', () => {
    const ten = many(1, 10);
    expect(dedupeRails([rail('a', ten)], { perRail: 14, exclude: ['movie:1'] })[0].items).toHaveLength(9);
    expect(dedupeRails([rail('a', many(1, 20))], { perRail: 14 })[0].items).toHaveLength(14);
  });
  it('keeps titles of a dropped rail available to later rails', () => {
    const shared = many(1, 3);
    const out = dedupeRails([rail('a', shared), rail('b', [...shared, ...many(50, 5)])], { perRail: 14 });
    expect(out.map((o) => o.id)).toEqual(['b']);
    expect(out[0].items).toHaveLength(8);
  });
  it('does not collide a movie and a series with the same id', () => {
    const out = dedupeRails([rail('a', [...many(1, 6)]), rail('b', many(1, 6, tv))], { perRail: 14 });
    expect(out).toHaveLength(2);
    expect(out[1].items).toHaveLength(6);
  });
});

describe('buildHomeRails', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get(`${BASE}/discover/movie`, () => HttpResponse.json(discoverMovies)),
      http.get(`${BASE}/discover/tv`, () => HttpResponse.json(trendingTv)),
      http.get(`${BASE}/movie/popular`, () => HttpResponse.json(discoverMovies)),
      http.get(`${BASE}/tv/on_the_air`, () => HttpResponse.json(trendingTv)),
      http.get(`${BASE}/trending/all/day`, () => HttpResponse.json(trendingAll)),
      http.get(`${BASE}/trending/tv/week`, () => HttpResponse.json(trendingTv)),
    );
  });
  afterEach(() => errorSpy.mockRestore());

  it('drops a rail whose source fails and keeps the rest', async () => {
    // now_playing is a discover/movie query (vote_count.gte=40 + release window).
    server.use(
      http.get(`${BASE}/discover/movie`, ({ request }) =>
        new URL(request.url).searchParams.get('vote_count.gte') === '40'
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json(discoverMovies),
      ),
    );
    const rails = await buildHomeRails();
    expect(rails.length).toBeGreaterThan(0);
    expect(rails.map((r) => r.id)).not.toContain('em-cartaz');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('em-cartaz'), expect.anything());
  });

  it('includes em-cartaz when no source fails', async () => {
    const rails = await buildHomeRails();
    expect(rails.map((r) => r.id)).toContain('em-cartaz');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('never repeats a title across rails and honours exclude', async () => {
    const rails = await buildHomeRails(['movie:1263337']);
    const keys = rails.flatMap((r) => r.items.map((i) => `${i.mediaType}:${i.id}`));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('movie:1263337');
  });
});

describe('feed disponível no Brasil', () => {
  /** Page 2 of a trending list: the same kind of titles under new ids (parity kept, so evens stay available). */
  const shifted = <T extends { results: { id: number }[] }>(body: T, by: number): T => ({
    ...body,
    page: 2,
    results: body.results.map((r) => ({ ...r, id: r.id + by })),
  });
  // TMDb applies watch_region + monetization itself on discover; the stand-in keeps only the even ids then.
  const discoverOf = (body: { results: { id: number }[] }) => ({ request }: { request: Request }) => {
    const filtered = new URL(request.url).searchParams.has('with_watch_monetization_types');
    return HttpResponse.json(filtered ? { ...body, results: body.results.filter((r) => r.id % 2 === 0) } : body);
  };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get(`${BASE}/discover/movie`, discoverOf(discoverMovies)),
      http.get(`${BASE}/discover/tv`, discoverOf(trendingTv)),
      http.get(`${BASE}/movie/popular`, () => HttpResponse.json(discoverMovies)),
      http.get(`${BASE}/tv/on_the_air`, () => HttpResponse.json(trendingTv)),
      http.get(`${BASE}/trending/tv/week`, () => HttpResponse.json(trendingTv)),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('a trending rail keeps only available titles and tops up from page 2 when page 1 falls short', async () => {
    onlyEvenAvailableInBr();
    const pages: string[] = [];
    server.use(
      http.get(`${BASE}/trending/all/day`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        pages.push(page);
        return HttpResponse.json(page === '2' ? shifted(trendingAll, 1_000_000) : trendingAll);
      }),
    );
    const rails = await buildHomeRails();
    const trending = rails.find((r) => r.id === 'bombando-hoje')!;
    expect(trending.items.every((i) => i.id % 2 === 0)).toBe(true);
    // Page 1 has only 6 available titles (< 12), so page 2 is asked and its titles fill the rail.
    expect(pages).toEqual(['1', '2']);
    expect(trending.items.some((i) => i.id > 1_000_000)).toBe(true);
    expect(trending.items.length).toBeGreaterThan(6);
    // Every other rail too, except the exempt release rails ("Nos cinemas", "Em breve").
    const feed = rails.filter((r) => r.id !== 'em-cartaz' && r.id !== 'em-breve');
    expect(feed.length).toBeGreaterThanOrEqual(2);
    expect(feed.flatMap((r) => r.items).every((i) => i.id % 2 === 0)).toBe(true);
    expect(rails.find((r) => r.id === 'em-cartaz')!.items.some((i) => i.id % 2 === 1)).toBe(true);
  });

  it('does not ask page 2 when page 1 already has 12 available titles', async () => {
    const pages: string[] = [];
    server.use(
      http.get(`${BASE}/trending/all/day`, ({ request }) => {
        pages.push(new URL(request.url).searchParams.get('page') ?? '1');
        return HttpResponse.json(trendingAll);
      }),
    );
    await buildHomeRails();
    expect(pages).toEqual(['1']);
  });

  it('the home hero is picked only among available titles', async () => {
    onlyEvenAvailableInBr();
    server.use(
      http.get(`${BASE}/trending/all/day`, () => HttpResponse.json(trendingAll)),
      // Listed before movie/:id, which would otherwise also match movie/popular.
      http.get(`${BASE}/movie/popular`, () => HttpResponse.json(discoverMovies)),
      http.get(`${BASE}/movie/:id`,({ params }) => HttpResponse.json({ ...movie550, id: Number(params.id) })),
      http.get(`${BASE}/tv/:id`, ({ params }) => HttpResponse.json({ ...tv1399, id: Number(params.id) })),
    );
    const featured = await getFeatured();
    expect(featured).not.toBeNull();
    expect(featured!.item.id % 2).toBe(0);
  });
});

describe('falha total do TMDb', () => {
  it('requireRails lança quando nenhum trilho sobrou (ISR mantém a última página boa)', () => {
    expect(() => requireRails([], 'home')).toThrow(/no rail/);
    expect(requireRails([1], 'home')).toEqual([1]);
  });

  it('getFeatured lança quando todas as fontes falham, em vez de cachear uma home vazia', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get(`${BASE}/trending/all/day`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE}/movie/popular`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE}/discover/movie`, () => new HttpResponse(null, { status: 500 })),
    );
    await expect(getFeatured()).rejects.toThrow(/every featured source failed/);
    spy.mockRestore();
  });

  it('sem nenhuma fonte, buildHomeRails volta vazio e requireRails transforma isso em erro', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get(`${BASE}/*`, () => new HttpResponse(null, { status: 503 })));
    const rails = await buildHomeRails();
    expect(rails).toEqual([]);
    expect(() => requireRails(rails, 'home')).toThrow();
    spy.mockRestore();
  });
});
