import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { movie, tv } from '@/test/media';
import { onlyEvenAvailableInBr } from '@/test/providers';
import { server } from '@/test/server';
import {
  BR_AVAILABLE_MONETIZATION,
  brAvailabilityParams,
  filterAvailableInBr,
  isAvailableInBr,
} from './availability';

const BASE = 'https://api.themoviedb.org/3';
const provider = { provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' };

function providersFor(media: 'movie' | 'tv', id: number, results: Record<string, unknown>) {
  server.use(http.get(`${BASE}/${media}/${id}/watch/providers`, () => HttpResponse.json({ id, results })));
}

describe('brAvailabilityParams', () => {
  it('asks for any BR offer: subscription, free, ads, rent or buy', () => {
    expect(BR_AVAILABLE_MONETIZATION).toBe('flatrate|free|ads|rent|buy');
    expect(brAvailabilityParams()).toEqual({
      watch_region: 'BR',
      with_watch_monetization_types: 'flatrate|free|ads|rent|buy',
    });
  });
});

describe('isAvailableInBr', () => {
  it('is true when BR has a rent offer, and asks in pt-BR', async () => {
    const seen: { url?: URL } = {};
    server.use(
      http.get(`${BASE}/movie/5001/watch/providers`, ({ request }) => {
        seen.url = new URL(request.url);
        return HttpResponse.json({ id: 5001, results: { BR: { link: 'x', rent: [provider] } } });
      }),
    );
    expect(await isAvailableInBr('movie', 5001)).toBe(true);
    expect(seen.url!.searchParams.get('language')).toBe('pt-BR');
  });

  it('is true for a series with only a free offer', async () => {
    providersFor('tv', 5002, { BR: { free: [provider] } });
    expect(await isAvailableInBr('tv', 5002)).toBe(true);
  });

  it('is false when BR only has empty lists', async () => {
    providersFor('movie', 5003, { BR: { link: 'x', flatrate: [], rent: [], buy: [] } });
    expect(await isAvailableInBr('movie', 5003)).toBe(false);
  });

  it('is false when only other regions have offers', async () => {
    providersFor('movie', 5004, { US: { flatrate: [provider] }, PT: { buy: [provider] } });
    expect(await isAvailableInBr('movie', 5004)).toBe(false);
  });

  it('is false on a TMDb 404 or a server error, never throwing', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get(`${BASE}/movie/5005/watch/providers`, () => HttpResponse.json({ status_message: 'nf' }, { status: 404 })),
      http.get(`${BASE}/movie/5006/watch/providers`, () => HttpResponse.json({ status_message: 'boom' }, { status: 500 })),
    );
    expect(await isAvailableInBr('movie', 5005)).toBe(false);
    expect(await isAvailableInBr('movie', 5006)).toBe(false);
    // Only the real failure is logged; a 404 just means TMDb has no such title.
    expect(errors).toHaveBeenCalledTimes(1);
    errors.mockRestore();
  });
});

describe('filterAvailableInBr', () => {
  it('keeps only available titles, in their original order, for movies and series', async () => {
    onlyEvenAvailableInBr();
    const items = [movie({ id: 12 }), tv({ id: 7 }), tv({ id: 4 }), movie({ id: 3 }), movie({ id: 2 })];
    const result = await filterAvailableInBr(items);
    expect(result.map((i) => `${i.mediaType}:${i.id}`)).toEqual(['movie:12', 'tv:4', 'movie:2']);
  });

  it('respects limit and stops asking once it is reached', async () => {
    const asked = onlyEvenAvailableInBr();
    const items = Array.from({ length: 40 }, (_, i) => movie({ id: 100 + i }));
    const result = await filterAvailableInBr(items, { limit: 3 });
    expect(result.map((i) => i.id)).toEqual([100, 102, 104]);
    // Chunks of 10: the first chunk already holds 5 available titles, so no second chunk is asked.
    expect(asked).toHaveLength(10);
  });

  it('asks at most 10 titles at a time', async () => {
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
    const items = Array.from({ length: 25 }, (_, i) => movie({ id: 300 + i }));
    expect(await filterAvailableInBr(items)).toHaveLength(25);
    expect(peak).toBeLessThanOrEqual(10);
  });

  it('returns an empty list for no input or a zero limit', async () => {
    expect(await filterAvailableInBr([])).toEqual([]);
    expect(await filterAvailableInBr([movie({ id: 2 })], { limit: 0 })).toEqual([]);
  });
});
