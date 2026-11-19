import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { server } from '@/test/server';
import { isTmdbNotFound, retryDelay, TmdbError, tmdbFetch } from './client';

const BASE = 'https://api.themoviedb.org/3';
const schema = z.object({ id: z.number() });

function capture(path: string) {
  const captured: { request?: Request } = {};
  server.use(
    http.get(`${BASE}/${path}`, ({ request }) => {
      captured.request = request;
      return HttpResponse.json({ id: 550 });
    }),
  );
  return captured;
}

describe('tmdbFetch', () => {
  it('envia Bearer e language=pt-BR, sem api_key', async () => {
    const captured = capture('movie/550');
    await tmdbFetch('movie/550', {}, schema);
    const url = new URL(captured.request!.url);
    expect(captured.request!.headers.get('authorization')).toBe('Bearer test-token');
    expect(url.searchParams.get('language')).toBe('pt-BR');
    expect(url.searchParams.has('api_key')).toBe(false);
  });

  it('permite sobrescrever o language', async () => {
    const captured = capture('movie/550');
    await tmdbFetch('movie/550', { language: 'en-US' }, schema);
    expect(new URL(captured.request!.url).searchParams.get('language')).toBe('en-US');
  });

  it('omite params undefined/null/vazios', async () => {
    const captured = capture('discover/movie');
    await tmdbFetch(
      'discover/movie',
      { page: 2, year: undefined, region: null, query: '', adult: false },
      schema,
    );
    const params = new URL(captured.request!.url).searchParams;
    expect(params.get('page')).toBe('2');
    expect(params.get('adult')).toBe('false');
    expect(params.has('year')).toBe(false);
    expect(params.has('region')).toBe(false);
    expect(params.has('query')).toBe(false);
  });

  it('codifica a query corretamente', async () => {
    const captured = capture('search/multi');
    await tmdbFetch('search/multi', { query: 'coração a&b' }, schema);
    expect(new URL(captured.request!.url).searchParams.get('query')).toBe('coração a&b');
  });

  it('404 vira TmdbError e isTmdbNotFound=true', async () => {
    server.use(
      http.get(`${BASE}/movie/1`, () =>
        HttpResponse.json({ status_message: 'The resource could not be found.' }, { status: 404 }),
      ),
    );
    const error = await tmdbFetch('movie/1', {}, schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TmdbError);
    expect(error).toMatchObject({
      status: 404,
      path: 'movie/1',
      message: 'The resource could not be found.',
    });
    expect(isTmdbNotFound(error)).toBe(true);
    expect(isTmdbNotFound(new Error('x'))).toBe(false);
  });

  it('500 vira TmdbError status 500', async () => {
    server.use(http.get(`${BASE}/movie/2`, () => new HttpResponse('boom', { status: 500 })));
    const error = await tmdbFetch('movie/2', {}, schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TmdbError);
    expect(error).toMatchObject({ status: 500, path: 'movie/2' });
    expect(isTmdbNotFound(error)).toBe(false);
  });

  it('falha de rede vira TmdbError status 0', async () => {
    server.use(http.get(`${BASE}/movie/3`, () => HttpResponse.error()));
    const error = await tmdbFetch('movie/3', {}, schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TmdbError);
    expect(error).toMatchObject({ status: 0, path: 'movie/3' });
  });

  it('resposta fora do schema lança erro com o path', async () => {
    server.use(http.get(`${BASE}/movie/4`, () => HttpResponse.json({ id: 'abc' })));
    await expect(tmdbFetch('movie/4', {}, schema)).rejects.toThrow(/movie\/4/);
  });

  it('envia um signal com timeout e mapeia o estouro para TmdbError status 0', async () => {
    const spy = vi.spyOn(AbortSignal, 'timeout');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce((_url, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Promise.reject(new DOMException('The operation timed out.', 'TimeoutError'));
    });
    const error = await tmdbFetch('movie/5', {}, schema).catch((e: unknown) => e);
    expect(spy).toHaveBeenCalledWith(8000);
    expect(error).toBeInstanceOf(TmdbError);
    expect(error).toMatchObject({ status: 0, path: 'movie/5' });
    expect((error as Error).message).toContain('tempo esgotado');
    spy.mockRestore();
    fetchSpy.mockRestore();
  });

  it('2xx com corpo não JSON vira TmdbError com o path', async () => {
    server.use(http.get(`${BASE}/movie/6`, () => new HttpResponse('<html>oops</html>', { status: 200 })));
    const error = await tmdbFetch('movie/6', {}, schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TmdbError);
    expect(error).toMatchObject({ status: 200, path: 'movie/6' });
  });

  describe('429 (rate limit)', () => {
    /** Answers 429 `times` times (with `retryAfter` when given), then 200; counts the requests. */
    function limited(id: number, times: number, retryAfter?: string) {
      const seen = { count: 0 };
      server.use(
        http.get(`${BASE}/movie/${id}`, () => {
          seen.count += 1;
          if (seen.count > times) return HttpResponse.json({ id });
          const headers = retryAfter === undefined ? undefined : { 'retry-after': retryAfter };
          return HttpResponse.json({ status_message: 'rate limited' }, { status: 429, headers });
        }),
      );
      return seen;
    }
    it('retries after a 429 and returns the later success', async () => {
      const seen = limited(7001, 1, '0');
      expect(await tmdbFetch('movie/7001', {}, schema)).toEqual({ id: 7001 });
      expect(seen.count).toBe(2);
    });

    it('gives up after 2 retries with the 429 error', async () => {
      const seen = limited(7002, 5, '0');
      const error = await tmdbFetch('movie/7002', {}, schema).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TmdbError);
      expect(error).toMatchObject({ status: 429, path: 'movie/7002' });
      expect(seen.count).toBe(3);
    });

    it('waits 300 ms then 900 ms without Retry-After, and honours Retry-After (seconds or date) capped at 2 s', () => {
      const res = (retryAfter?: string) =>
        new Response(null, { status: 429, headers: retryAfter === undefined ? {} : { 'retry-after': retryAfter } });
      expect(retryDelay(res(), 0)).toBe(300);
      expect(retryDelay(res(), 1)).toBe(900);
      expect(retryDelay(res('1'), 0)).toBe(1000);
      expect(retryDelay(res('30'), 1)).toBe(2000);
      expect(retryDelay(res('0'), 1)).toBe(0);
      expect(retryDelay(res(new Date(Date.now() + 60_000).toUTCString()), 0)).toBe(2000);
      expect(retryDelay(res('soon'), 1)).toBe(900);
    });

    it('waits the backoff for real between attempts', async () => {
      const seen = limited(7006, 1);
      const started = Date.now();
      await tmdbFetch('movie/7006', {}, schema);
      expect(seen.count).toBe(2);
      expect(Date.now() - started).toBeGreaterThanOrEqual(290);
    });

    it('does not retry other errors', async () => {
      let count = 0;
      server.use(
        http.get(`${BASE}/movie/7005`, () => {
          count += 1;
          return new HttpResponse('boom', { status: 500 });
        }),
      );
      await tmdbFetch('movie/7005', {}, schema).catch(() => {});
      expect(count).toBe(1);
    });
  });
});
