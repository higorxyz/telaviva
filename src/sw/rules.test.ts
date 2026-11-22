import { CacheFirst, NetworkFirst, type RouteMatchCallbackOptions, type RuntimeCaching } from 'serwist';
import { describe, expect, it } from 'vitest';
import { CACHE_NAMES, WARM_HEADER, isPrecachedPageRequest, isPrivateRequest, runtimeCaching } from './rules';

const SITE = 'https://telaviva.vercel.app';

type FakeRequest = { path: string; method?: string; mode?: RequestMode; headers?: Record<string, string> };

/** A request as the worker sees it. Built by hand: `new Request()` refuses `mode: 'navigate'`. */
function request({ path, method = 'GET', mode = 'cors', headers = {} }: FakeRequest) {
  const url = new URL(path, SITE);
  const req = { url: url.href, method, mode, headers: new Headers(headers), destination: '' } as unknown as Request;
  return { url, request: req, sameOrigin: url.origin === SITE } as RouteMatchCallbackOptions;
}

/** The rules Serwist would consider for this request (it registers each rule under its method, GET by default). */
function rulesFor(fake: FakeRequest): RuntimeCaching[] {
  const options = request(fake);
  return runtimeCaching.filter(
    (rule) =>
      (rule.method ?? 'GET') === options.request.method &&
      typeof rule.matcher === 'function' &&
      Boolean(rule.matcher(options)),
  );
}

function cacheNameFor(fake: FakeRequest): string | undefined {
  const [rule] = rulesFor(fake);
  return rule ? (rule.handler as NetworkFirst | CacheFirst).cacheName : undefined;
}

const navigate = (path: string): FakeRequest => ({ path, mode: 'navigate' });
const rsc = (path: string): FakeRequest => ({ path, headers: { RSC: '1' } });
const warm = (path: string): FakeRequest => ({ path, headers: { [WARM_HEADER]: '1', Accept: 'text/html' } });
const prefetch = (path: string): FakeRequest => ({ path, headers: { RSC: '1', 'Next-Router-Prefetch': '1' } });

describe('isPrivateRequest', () => {
  it.each([
    ['POST', '/api/library/commands'],
    ['GET', '/api/library'],
    ['GET', '/api/account/export'],
    ['GET', '/api/auth/me'],
    ['GET', '/__/auth/handler'],
    ['GET', '/serwist/sw.js'],
    ['POST', '/filmes'],
    ['PUT', '/api/tv/1399/season/1'],
    ['DELETE', '/api/catalog'],
  ])('%s %s is private', (method, path) => {
    expect(isPrivateRequest(new URL(path, SITE), method)).toBe(true);
  });

  it.each([
    ['GET', '/api/tv/1399/season/1'],
    ['GET', '/filmes'],
  ])('%s %s is public', (method, path) => {
    expect(isPrivateRequest(new URL(path, SITE), method)).toBe(false);
  });
});

describe('runtimeCaching', () => {
  const privatePaths = [
    '/api/library',
    '/api/library/commands',
    '/api/library/merge',
    '/api/account/export',
    '/api/auth/me',
    '/api/auth/session',
    '/__/auth/handler',
    '/__/auth/iframe?apiKey=x',
    '/serwist/sw.js',
  ];

  it.each(privatePaths)('no rule matches %s, however it is requested', (path) => {
    for (const fake of [{ path }, navigate(path), rsc(path), warm(path)]) {
      expect(rulesFor(fake)).toEqual([]);
    }
  });

  it('no rule matches a request that is not a GET', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
      for (const path of ['/filmes', '/api/tv/1399/season/1', '/api/catalog?list=popular', '/_next/static/chunks/a.js']) {
        expect(rulesFor({ path, method, headers: { RSC: '1' } })).toEqual([]);
      }
    }
  });

  it('never caches /api/tv/progress: its URL carries the list of series, so it changes with the library', () => {
    expect(rulesFor({ path: '/api/tv/progress?ids=1399,1396' })).toEqual([]);
    expect(rulesFor({ path: '/api/tv/progress' })).toEqual([]);
  });

  it('keeps public catalog data in tv-catalog-api, network first', () => {
    for (const path of [
      '/api/tv/1399/season/1',
      '/api/catalog?list=popular',
      '/api/discover?genre=28',
      '/api/search?q=duna',
    ]) {
      expect(cacheNameFor({ path }), path).toBe(CACHE_NAMES.catalog);
      expect(rulesFor({ path })[0].handler, path).toBeInstanceOf(NetworkFirst);
    }
    // Other API routes are not catalog data.
    expect(rulesFor({ path: '/api/recommendations?ids=1' })).toEqual([]);
    expect(rulesFor({ path: '/api/catalogue' })).toEqual([]);
  });

  it('keeps visited pages in tv-pages: navigations, RSC payloads and warm-up fetches', () => {
    for (const fake of [navigate('/filmes'), rsc('/filmes?_rsc=abc12'), warm('/serie/1399-game-of-thrones'), navigate('/')]) {
      expect(cacheNameFor(fake), fake.path).toBe(CACHE_NAMES.pages);
      expect(rulesFor(fake)[0].handler).toBeInstanceOf(NetworkFirst);
    }
  });

  it('never caches RSC prefetches: only the payload of a real navigation is kept', () => {
    expect(rulesFor(prefetch('/filmes?_rsc=p1'))).toEqual([]);
    expect(rulesFor({ path: '/filmes?_rsc=p2', headers: { RSC: '1', 'Next-Router-Prefetch': '1', 'Next-Router-Segment-Prefetch': '/_tree' } })).toEqual([]);
    expect(cacheNameFor(rsc('/filmes?_rsc=n1'))).toBe(CACHE_NAMES.pages);
  });

  it('leaves other same-origin fetches, API routes and other sites out of tv-pages', () => {
    expect(rulesFor({ path: '/filmes' })).toEqual([]);
    expect(rulesFor({ path: '/manifest.webmanifest' })).toEqual([]);
    expect(rulesFor(navigate('/api/recommendations'))).toEqual([]);
    expect(rulesFor(rsc('/api/recommendations'))).toEqual([]);
    expect(rulesFor(rsc('/_next/data/x.json'))).toEqual([]);
    expect(rulesFor(navigate('https://example.com/filmes'))).toEqual([]);
  });

  it('keeps build files in tv-static-reserve, cache first', () => {
    const fake = { path: '/_next/static/chunks/0a1b2c.js' };
    expect(cacheNameFor(fake)).toBe(CACHE_NAMES.staticReserve);
    expect(rulesFor(fake)[0].handler).toBeInstanceOf(CacheFirst);
    expect(rulesFor({ path: 'https://cdn.example.com/_next/static/chunks/0a1b2c.js' })).toEqual([]);
  });

  it('keeps TMDb images in tv-images, cache first', () => {
    const fake = { path: 'https://image.tmdb.org/t/p/w342/poster.jpg', mode: 'no-cors' as const };
    expect(cacheNameFor(fake)).toBe(CACHE_NAMES.images);
    expect(rulesFor(fake)[0].handler).toBeInstanceOf(CacheFirst);
    expect(rulesFor({ path: 'https://image.tmdb.org.evil.example/x.jpg' })).toEqual([]);
  });

  it('gives every request at most one rule', () => {
    for (const fake of [navigate('/filmes'), rsc('/filmes?_rsc=1'), { path: '/api/search?q=a' }, { path: '/_next/static/a.css' }]) {
      expect(rulesFor(fake)).toHaveLength(1);
    }
  });

  it('uses only the tv-* caches', () => {
    const names = runtimeCaching.map((rule) => (rule.handler as NetworkFirst | CacheFirst).cacheName);
    expect(names.sort()).toEqual(Object.values(CACHE_NAMES).sort());
  });
});

describe('isPrecachedPageRequest', () => {
  const matches = (fake: FakeRequest) => Boolean(isPrecachedPageRequest(request(fake)));

  it('takes navigations and warm-ups of / and /minha-lista, whatever the query', () => {
    for (const fake of [navigate('/'), navigate('/minha-lista'), navigate('/minha-lista?aba=assistidos'), warm('/'), warm('/minha-lista')]) {
      expect(matches(fake), fake.path).toBe(true);
    }
  });

  it('leaves RSC requests, prefetches, plain fetches, other pages and other sites alone', () => {
    for (const fake of [
      rsc('/minha-lista?_rsc=a1'),
      prefetch('/?_rsc=a2'),
      { path: '/' },
      navigate('/filmes'),
      navigate('/minha-lista/outra'),
      navigate('https://example.com/minha-lista'),
      { path: '/minha-lista', method: 'POST', mode: 'navigate' as const },
    ]) {
      expect(matches(fake), fake.path).toBe(false);
    }
  });
});
