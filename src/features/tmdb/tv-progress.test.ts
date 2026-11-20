import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import tv1399 from '@/test/fixtures/tv-1399.json';
import { server } from '@/test/server';
import { isTmdbNotFound } from './client';
import { getTvProgressSource } from './tv';

const { cacheLife } = vi.hoisted(() => ({ cacheLife: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife, cacheTag: () => {} }));

const BASE = 'https://api.themoviedb.org/3';

function serve(id: number, body: Record<string, unknown>) {
  const seen: { url?: URL; lookups: number } = { lookups: 0 };
  server.use(
    http.get(`${BASE}/tv/${id}`, ({ request }) => {
      seen.url = new URL(request.url);
      return HttpResponse.json({ ...tv1399, ...body, id });
    }),
    http.get(`${BASE}/:media/:id/watch/providers`, () => {
      seen.lookups += 1;
      return HttpResponse.json({ results: {} });
    }),
  );
  return seen;
}

beforeEach(() => cacheLife.mockClear());

describe('getTvProgressSource', () => {
  it('asks tv/{id} once, without append_to_response, and screens nothing', async () => {
    const seen = serve(9301, {});
    const tv = await getTvProgressSource(9301);
    expect(seen.url?.searchParams.has('append_to_response')).toBe(false);
    expect(seen.lookups).toBe(0);
    expect(tv).toEqual({
      id: 9301,
      status: 'Ended',
      seasons: expect.arrayContaining([expect.objectContaining({ seasonNumber: 1, episodeCount: 10 })]),
      lastEpisodeToAir: expect.objectContaining({ seasonNumber: 8 }),
      nextEpisodeToAir: null,
    });
    expect(Object.keys(tv)).not.toContain('recommendations');
  });

  it('keeps an ended series for the detail lifetime and a running one for the hot lifetime', async () => {
    serve(9302, { status: 'Ended' });
    await getTvProgressSource(9302);
    expect(cacheLife.mock.lastCall?.[0]).toBe('tmdbDetail');

    serve(9303, { status: 'Returning Series', in_production: true });
    await getTvProgressSource(9303);
    expect(cacheLife.mock.lastCall?.[0]).toBe('tmdbHot');
  });

  it('turns a 404 or an adult title into a recognizable TmdbError 404', async () => {
    server.use(http.get(`${BASE}/tv/9304`, () => HttpResponse.json({ status_message: 'nf' }, { status: 404 })));
    expect(isTmdbNotFound(await getTvProgressSource(9304).catch((e: unknown) => e))).toBe(true);
    serve(9305, { adult: true });
    expect(isTmdbNotFound(await getTvProgressSource(9305).catch((e: unknown) => e))).toBe(true);
  });
});
