import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import discoverMovies from '@/test/fixtures/discover-movie-popular.json';
import trendingAll from '@/test/fixtures/trending-all-day.json';
import trendingTv from '@/test/fixtures/trending-tv-week.json';
import { movie, tv } from '@/test/media';
import { server } from '@/test/server';
import { buildHomeRails, dedupeRails, type RailInput } from './rails';

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
    expect(errorSpy).toHaveBeenCalled();
  });

  it('never repeats a title across rails and honours exclude', async () => {
    const rails = await buildHomeRails(['movie:1263337']);
    const keys = rails.flatMap((r) => r.items.map((i) => `${i.mediaType}:${i.id}`));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain('movie:1263337');
  });
});
