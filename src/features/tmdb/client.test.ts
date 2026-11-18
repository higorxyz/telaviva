import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { server } from '@/test/server';
import { isTmdbNotFound, TmdbError, tmdbFetch } from './client';

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
});
