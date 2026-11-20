import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import moviePage from '@/test/fixtures/discover-movie-page-2.json';
import discoverMovies from '@/test/fixtures/discover-movie-popular.json';
import movie550 from '@/test/fixtures/movie-550.json';
import trendingAll from '@/test/fixtures/trending-all-day.json';
import trendingTv from '@/test/fixtures/trending-tv-week.json';
import { server } from '@/test/server';
import { getMovieDetails, getMovieList, getTrending } from './movies';
import { getAvailableRecommendations, getRecommendationsFor } from './recommendations';
import { getTvList } from './tv';

// The cache profile is observed through a spy on cacheLife. The outer function calls it after its lookups finish,
// so its profile is the last call (the provider lookups nested inside call it earlier with their own).
const { cacheLife } = vi.hoisted(() => ({ cacheLife: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife, cacheTag: () => {} }));

const BASE = 'https://api.themoviedb.org/3';
const outerProfile = () => cacheLife.mock.lastCall?.[0];

/** The provider lookup of `id` fails with `status`; every other title stays available (the default handler). */
function lookupFails(media: 'movie' | 'tv', id: number, status = 500) {
  server.use(
    http.get(`${BASE}/${media}/${id}/watch/providers`, () =>
      HttpResponse.json({ status_message: 'x' }, { status, headers: { 'retry-after': '0' } }),
    ),
  );
}

beforeEach(() => {
  cacheLife.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a failed availability lookup keeps the title and shortens the cache lifetime', () => {
  it('trending: tmdbHot when every lookup answered, minutes (title kept) when one failed', async () => {
    server.use(http.get(`${BASE}/trending/all/day`, () => HttpResponse.json(trendingAll)));
    const all = await getTrending('all', 'day', 1);
    expect(outerProfile()).toBe('tmdbHot');

    const first = trendingAll.results[0]!;
    lookupFails(first.media_type as 'movie' | 'tv', first.id);
    cacheLife.mockClear();
    const again = await getTrending('all', 'day', 1);
    expect(again.results.map((r) => r.id)).toEqual(all.results.map((r) => r.id));
    expect(outerProfile()).toBe('minutes');
    expect(cacheLife).not.toHaveBeenCalledWith('tmdbHot');
  });

  it('on_the_air after a lasting 429, and movie popular after a 500', async () => {
    server.use(
      http.get(`${BASE}/tv/on_the_air`, () => HttpResponse.json(trendingTv)),
      http.get(`${BASE}/movie/popular`, () => HttpResponse.json(discoverMovies)),
    );
    lookupFails('tv', trendingTv.results[0]!.id, 429);
    const onAir = await getTvList('on_the_air', 1);
    expect(onAir.results.map((r) => r.id)).toContain(trendingTv.results[0]!.id);
    expect(outerProfile()).toBe('minutes');

    const popular = await getMovieList('popular', 1);
    lookupFails('movie', popular.results[0]!.id);
    cacheLife.mockClear();
    const again = await getMovieList('popular', 1);
    expect(again.results[0]!.id).toBe(popular.results[0]!.id);
    expect(outerProfile()).toBe('minutes');
  });

  it('discover lists keep their normal profile (they do no lookups)', async () => {
    server.use(http.get(`${BASE}/discover/movie`, () => HttpResponse.json(discoverMovies)));
    await getMovieList('top_rated', 1);
    expect(cacheLife.mock.calls).toEqual([['tmdbHot']]);
  });

  it('seed recommendations: tmdbDetail normally, minutes (title kept) when a lookup failed', async () => {
    server.use(http.get(`${BASE}/movie/:id/recommendations`, () => HttpResponse.json(moviePage)));
    await getRecommendationsFor('movie', 8101, 20);
    expect(outerProfile()).toBe('tmdbDetail');

    lookupFails('movie', moviePage.results[0]!.id);
    cacheLife.mockClear();
    const recs = await getRecommendationsFor('movie', 8102, 20);
    expect(recs.map((r) => r.id)).toContain(moviePage.results[0]!.id);
    expect(outerProfile()).toBe('minutes');
  });

  it('details never wait on lookups: a failed lookup no longer shortens the detail, only the screened rail', async () => {
    const rec = movie550.recommendations.results[0]!;
    lookupFails('movie', rec.id);
    server.use(http.get(`${BASE}/movie/8202`, () => HttpResponse.json({ ...movie550, id: 8202 })));
    const details = await getMovieDetails(8202);
    expect(outerProfile()).toBe('tmdbDetail');

    cacheLife.mockClear();
    const screened = await getAvailableRecommendations('movie', 8202, details.recommendations);
    expect(screened.map((r) => r.id)).toContain(rec.id);
    expect(outerProfile()).toBe('minutes');

    cacheLife.mockClear();
    await getAvailableRecommendations('movie', 8203, details.recommendations.slice(1));
    expect(outerProfile()).toBe('tmdbDetail');
  });
});
