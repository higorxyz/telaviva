import type { HandlerDidErrorCallbackParam } from 'serwist';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  corsImageRequest,
  documentCacheKey,
  documentUrlForRsc,
  pageCacheKey,
  precachedPageFallback,
  rscDocumentFallback,
  savedDocument,
} from './plugins';

const SITE = 'https://telaviva.vercel.app';

const rscRequest = (path: string) => new Request(new URL(path, SITE), { headers: { RSC: '1' } });
const plainRequest = (path: string) => new Request(new URL(path, SITE));

describe('pageCacheKey', () => {
  it('keys a document by its URL without the _rsc param, keeping the rest of the query', () => {
    expect(pageCacheKey(plainRequest('/minha-lista?aba=assistidos&_rsc=x1'))).toBe(`${SITE}/minha-lista?aba=assistidos`);
    expect(pageCacheKey(plainRequest('/filmes'))).toBe(`${SITE}/filmes`);
  });

  it('keys an RSC payload by its own URL, _rsc included', () => {
    expect(pageCacheKey(rscRequest('/filmes?_rsc=abc12'))).toBe(`${SITE}/filmes?_rsc=abc12`);
  });
});

describe('documentCacheKey plugin', () => {
  const keyFor = (request: Request) =>
    documentCacheKey.cacheKeyWillBeUsed!({ request, mode: 'read', event: {} as ExtendableEvent, params: undefined });

  it('leaves RSC requests and documents without _rsc untouched', async () => {
    const payload = rscRequest('/filmes?_rsc=abc12');
    const document = plainRequest('/filmes');
    expect(await keyFor(payload)).toBe(payload);
    expect(await keyFor(document)).toBe(document);
  });

  it('drops _rsc from a document key', async () => {
    expect(await keyFor(plainRequest('/filmes?_rsc=abc12'))).toBe(`${SITE}/filmes`);
  });
});

describe('documentUrlForRsc', () => {
  it('points an RSC request at the same page document', () => {
    expect(documentUrlForRsc(rscRequest('/serie/1399-game-of-thrones?temporada=2&_rsc=k9'))).toBe(
      `${SITE}/serie/1399-game-of-thrones?temporada=2`,
    );
  });

  it('is null for a document request', () => {
    expect(documentUrlForRsc(plainRequest('/filmes'))).toBeNull();
  });
});

describe('rscDocumentFallback', () => {
  const html = () => new Response('<!doctype html><title>Filmes</title>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  /** A document lookup that records what it was asked for. */
  function finder(entries: Record<string, Response>) {
    const looked: string[] = [];
    const find = async (url: string) => (looked.push(url), entries[url]?.clone());
    return { find, looked };
  }

  const fail = (find: (url: string) => Promise<Response | undefined>, request: Request) =>
    rscDocumentFallback(find).handlerDidError!({
      request,
      event: {} as ExtendableEvent,
      error: new TypeError('Failed to fetch'),
    } satisfies HandlerDidErrorCallbackParam);

  it('answers a failed RSC request with the document of the same page, as HTML', async () => {
    const { find, looked } = finder({ [`${SITE}/filmes`]: html() });
    const response = await fail(find, rscRequest('/filmes?_rsc=abc12'));
    expect(looked).toEqual([`${SITE}/filmes`]);
    expect(response?.headers.get('Content-Type')).toMatch(/^text\/html/);
    expect(await response?.text()).toContain('<title>Filmes</title>');
  });

  it('lets the failure through when the page has no saved document', async () => {
    const { find } = finder({});
    expect(await fail(find, rscRequest('/series?_rsc=abc12'))).toBeUndefined();
  });

  it('never answers with something that is not a document', async () => {
    const { find } = finder({ [`${SITE}/filmes`]: new Response('0:{}', { headers: { 'Content-Type': 'text/x-component' } }) });
    expect(await fail(find, rscRequest('/filmes?_rsc=abc12'))).toBeUndefined();
  });

  it('leaves failed document requests to the offline page fallback', async () => {
    const { find, looked } = finder({ [`${SITE}/filmes`]: html() });
    expect(await fail(find, plainRequest('/filmes'))).toBeUndefined();
    expect(looked).toEqual([]);
  });

  it('only acts on failures: responses that arrived are never touched', () => {
    expect(Object.keys(rscDocumentFallback(async () => undefined))).toEqual(['handlerDidError']);
  });
});

describe('savedDocument', () => {
  function stubPagesCache(entries: Record<string, Response>) {
    const opened: string[] = [];
    vi.stubGlobal('caches', {
      open: async (name: string) => (opened.push(name), { match: async (key: string) => entries[key]?.clone() }),
    });
    return opened;
  }

  const precache = () => {
    const asked: string[] = [];
    const match = async (url: string) => (asked.push(url), new Response(`precached ${url}`));
    return { match, asked };
  };

  afterEach(() => vi.unstubAllGlobals());

  it('prefers the copy in tv-pages', async () => {
    const opened = stubPagesCache({ [`${SITE}/minha-lista`]: new Response('tv-pages copy') });
    const { match, asked } = precache();
    const response = await savedDocument('tv-pages', match)(`${SITE}/minha-lista`);
    expect(opened).toEqual(['tv-pages']);
    expect(await response?.text()).toBe('tv-pages copy');
    expect(asked).toEqual([]);
  });

  it('falls back to the precached copy of / and /minha-lista, by path', async () => {
    stubPagesCache({});
    const { match, asked } = precache();
    expect(await (await savedDocument('tv-pages', match)(`${SITE}/minha-lista?aba=quero-ver`))?.text()).toBe('precached /minha-lista');
    expect(await (await savedDocument('tv-pages', match)(`${SITE}/`))?.text()).toBe('precached /');
    expect(asked).toEqual(['/minha-lista', '/']);
  });

  it('never asks the precache for other pages', async () => {
    stubPagesCache({});
    const { match, asked } = precache();
    expect(await savedDocument('tv-pages', match)(`${SITE}/filmes`)).toBeUndefined();
    expect(asked).toEqual([]);
  });
});

describe('precachedPageFallback', () => {
  it('answers a failed navigation to a precached page with its precached copy, whatever the query', async () => {
    const asked: string[] = [];
    const plugin = precachedPageFallback(async (url) => (asked.push(url), new Response('precached')));
    const response = await plugin.handlerDidError!({
      request: plainRequest('/minha-lista?aba=assistidos'),
      event: {} as ExtendableEvent,
      error: new TypeError('Failed to fetch'),
    });
    expect(asked).toEqual(['/minha-lista']);
    expect(await response?.text()).toBe('precached');
  });
});

describe('corsImageRequest', () => {
  const upgrade = (request: Request) =>
    corsImageRequest.requestWillFetch!({ request, event: {} as ExtendableEvent });

  it('refetches a no-cors image in CORS mode without credentials, so the cache stores a readable response', async () => {
    const original = new Request('https://image.tmdb.org/t/p/w342/poster.jpg', { mode: 'no-cors' });
    const upgraded = await upgrade(original);
    expect(upgraded.url).toBe(original.url);
    expect(upgraded.mode).toBe('cors');
    expect(upgraded.credentials).toBe('omit');
    // Not the HTTP cache: a no-cors copy stored there has no Access-Control-Allow-Origin (the CDN sends no Vary).
    expect(upgraded.cache).toBe('reload');
  });

  it('when the CORS fetch failed, lets the page\'s own request through unchanged (shown, not cached)', async () => {
    const original = new Request('https://image.tmdb.org/t/p/w342/poster.jpg', { mode: 'no-cors' });
    const answer = new Response('img');
    const fetch = vi.fn(async () => answer);
    vi.stubGlobal('fetch', fetch);
    const result = await corsImageRequest.handlerDidError!({
      request: original,
      event: {} as ExtendableEvent,
      error: new TypeError('Failed to fetch'),
      state: {},
    } as HandlerDidErrorCallbackParam);
    expect(fetch).toHaveBeenCalledWith(original);
    expect(result).toBe(answer);
  });

  it('answers nothing when the plain request fails too (the offline fallback rules apply)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    const result = await corsImageRequest.handlerDidError!({
      request: new Request('https://image.tmdb.org/t/p/w342/poster.jpg'),
      event: {} as ExtendableEvent,
      error: new TypeError('Failed to fetch'),
      state: {},
    } as HandlerDidErrorCallbackParam);
    expect(result).toBeUndefined();
  });

  it('keeps a request that is already CORS', async () => {
    const original = new Request('https://image.tmdb.org/t/p/w342/poster.jpg', { mode: 'cors' });
    expect(await upgrade(original)).toBe(original);
  });
});
