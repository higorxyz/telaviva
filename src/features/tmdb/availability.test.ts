import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { movie, tv } from '@/test/media';
import { onlyEvenAvailableInBr } from '@/test/providers';
import { server } from '@/test/server';
import {
  availabilityInBr,
  BR_AVAILABLE_MONETIZATION,
  brAvailabilityParams,
  filterAvailableInBr,
  MAX_PROVIDER_LOOKUPS_IN_FLIGHT,
  screenAvailableInBr,
} from './availability';

const BASE = 'https://api.themoviedb.org/3';
const provider = { provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' };

function providersFor(media: 'movie' | 'tv', id: number, results: Record<string, unknown>) {
  server.use(http.get(`${BASE}/${media}/${id}/watch/providers`, () => HttpResponse.json({ id, results })));
}
const failWith = (status: number, headers?: Record<string, string>) => () =>
  HttpResponse.json({ status_message: 'x' }, { status, headers });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('brAvailabilityParams', () => {
  it('asks for any BR offer: subscription, free, ads, rent or buy', () => {
    expect(BR_AVAILABLE_MONETIZATION).toBe('flatrate|free|ads|rent|buy');
    expect(brAvailabilityParams()).toEqual({
      watch_region: 'BR',
      with_watch_monetization_types: 'flatrate|free|ads|rent|buy',
    });
  });
});

describe('availabilityInBr', () => {
  it('is yes when BR has a rent offer, and asks in pt-BR', async () => {
    const seen: { url?: URL } = {};
    server.use(
      http.get(`${BASE}/movie/5001/watch/providers`, ({ request }) => {
        seen.url = new URL(request.url);
        return HttpResponse.json({ id: 5001, results: { BR: { link: 'x', rent: [provider] } } });
      }),
    );
    expect(await availabilityInBr('movie', 5001)).toBe('yes');
    expect(seen.url!.searchParams.get('language')).toBe('pt-BR');
  });

  it('is yes for a series with only a free offer', async () => {
    providersFor('tv', 5002, { BR: { free: [provider] } });
    expect(await availabilityInBr('tv', 5002)).toBe('yes');
  });

  it('is no when BR only has empty lists, or only other regions have offers', async () => {
    providersFor('movie', 5003, { BR: { link: 'x', flatrate: [], rent: [], buy: [] } });
    providersFor('movie', 5004, { US: { flatrate: [provider] }, PT: { buy: [provider] } });
    expect(await availabilityInBr('movie', 5003)).toBe('no');
    expect(await availabilityInBr('movie', 5004)).toBe('no');
  });

  it('is no on a TMDb 404, and unknown (logged, never thrown) on a failure or a lasting 429', async () => {
    server.use(
      http.get(`${BASE}/movie/5005/watch/providers`, failWith(404)),
      http.get(`${BASE}/movie/5006/watch/providers`, failWith(500)),
      http.get(`${BASE}/movie/5007/watch/providers`, failWith(429, { 'retry-after': '0' })),
    );
    expect(await availabilityInBr('movie', 5005)).toBe('no');
    expect(await availabilityInBr('movie', 5006)).toBe('unknown');
    expect(await availabilityInBr('movie', 5007)).toBe('unknown');
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

describe('screenAvailableInBr / filterAvailableInBr', () => {
  it('keeps only available titles, in their original order, for movies and series', async () => {
    onlyEvenAvailableInBr();
    const items = [movie({ id: 12 }), tv({ id: 7 }), tv({ id: 4 }), movie({ id: 3 }), movie({ id: 2 })];
    const result = await filterAvailableInBr(items);
    expect(result.map((i) => `${i.mediaType}:${i.id}`)).toEqual(['movie:12', 'tv:4', 'movie:2']);
    expect(await screenAvailableInBr(items)).toEqual({ items: result, unknown: false });
  });

  it('fails open: a title whose lookup failed is kept, and the screen reports it', async () => {
    onlyEvenAvailableInBr();
    server.use(http.get(`${BASE}/movie/9/watch/providers`, failWith(500)));
    const items = [movie({ id: 2 }), movie({ id: 9 }), movie({ id: 3 })];
    const screened = await screenAvailableInBr(items);
    expect(screened.items.map((i) => i.id)).toEqual([2, 9]);
    expect(screened.unknown).toBe(true);
  });

  it('respects limit and stops asking once it is reached', async () => {
    const asked = onlyEvenAvailableInBr();
    const items = Array.from({ length: 40 }, (_, i) => movie({ id: 100 + i }));
    const result = await filterAvailableInBr(items, { limit: 3 });
    expect(result.map((i) => i.id)).toEqual([100, 102, 104]);
    // Chunks of 10: the first chunk already holds 5 available titles, so no second chunk is asked.
    expect(asked).toHaveLength(10);
  });

  it(`keeps at most ${MAX_PROVIDER_LOOKUPS_IN_FLIGHT} provider lookups in flight, across parallel callers`, async () => {
    let inFlight = 0;
    let peak = 0;
    server.use(
      http.get(`${BASE}/:media/:id/watch/providers`, async ({ params }) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return HttpResponse.json({ id: Number(params.id), results: { BR: { flatrate: [provider] } } });
      }),
    );
    const list = (from: number) => Array.from({ length: 25 }, (_, i) => movie({ id: from + i }));
    const [a, b, c] = await Promise.all([filterAvailableInBr(list(300)), filterAvailableInBr(list(400)), filterAvailableInBr(list(500))]);
    expect([a.length, b.length, c.length]).toEqual([25, 25, 25]);
    expect(MAX_PROVIDER_LOOKUPS_IN_FLIGHT).toBe(8);
    expect(peak).toBeLessThanOrEqual(8);
    expect(peak).toBeGreaterThan(1);
  });

  it('returns an empty list for no input or a zero limit', async () => {
    expect(await filterAvailableInBr([])).toEqual([]);
    expect(await filterAvailableInBr([movie({ id: 2 })], { limit: 0 })).toEqual([]);
  });
});
