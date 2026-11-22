import type { HandlerDidErrorCallbackParam } from 'serwist';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { corsImageRequest, documentCacheKey, documentUrlForRsc, pageCacheKey, rscDocumentFallback } from './plugins';

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

  function stubCache(entries: Record<string, Response>) {
    const opened: string[] = [];
    const looked: string[] = [];
    vi.stubGlobal('caches', {
      open: async (name: string) => {
        opened.push(name);
        return { match: async (key: string) => (looked.push(key), entries[key]?.clone()) };
      },
    });
    return { opened, looked };
  }

  const fail = (request: Request) =>
    rscDocumentFallback('tv-pages').handlerDidError!({
      request,
      event: {} as ExtendableEvent,
      error: new TypeError('Failed to fetch'),
    } satisfies HandlerDidErrorCallbackParam);

  afterEach(() => vi.unstubAllGlobals());

  it('answers a failed RSC request with the cached document of the same page, as HTML', async () => {
    const { opened, looked } = stubCache({ [`${SITE}/filmes`]: html() });
    const response = await fail(rscRequest('/filmes?_rsc=abc12'));
    expect(opened).toEqual(['tv-pages']);
    expect(looked).toEqual([`${SITE}/filmes`]);
    expect(response?.headers.get('Content-Type')).toMatch(/^text\/html/);
    expect(await response?.text()).toContain('<title>Filmes</title>');
  });

  it('lets the failure through when the page has no cached document', async () => {
    stubCache({});
    expect(await fail(rscRequest('/series?_rsc=abc12'))).toBeUndefined();
  });

  it('never answers with something that is not a document', async () => {
    stubCache({ [`${SITE}/filmes`]: new Response('0:{}', { headers: { 'Content-Type': 'text/x-component' } }) });
    expect(await fail(rscRequest('/filmes?_rsc=abc12'))).toBeUndefined();
  });

  it('leaves failed document requests to the offline page fallback', async () => {
    const { opened } = stubCache({ [`${SITE}/filmes`]: html() });
    expect(await fail(plainRequest('/filmes'))).toBeUndefined();
    expect(opened).toEqual([]);
  });

  it('only acts on failures: responses that arrived are never touched', () => {
    expect(Object.keys(rscDocumentFallback('tv-pages'))).toEqual(['handlerDidError']);
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
  });

  it('keeps a request that is already CORS', async () => {
    const original = new Request('https://image.tmdb.org/t/p/w342/poster.jpg', { mode: 'cors' });
    expect(await upgrade(original)).toBe(original);
  });
});
