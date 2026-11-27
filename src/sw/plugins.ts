import type { SerwistPlugin } from 'serwist';
import { isPrecachedPagePath } from './precached-pages';

/** Next's cache-busting param on RSC requests (a hash of the router headers). */
const RSC_PARAM = '_rsc';

const isRscRequest = (request: Request) => request.headers.get('RSC') === '1';

function withoutRscParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete(RSC_PARAM);
  return url.href;
}

/**
 * Where a page response lives in `tv-pages`: an RSC payload under its own URL (`_rsc` tells payloads apart), a
 * document under the page URL without `_rsc`, the key the RSC fallback below looks up.
 */
export function pageCacheKey(request: Request): string {
  return isRscRequest(request) ? request.url : withoutRscParam(request.url);
}

/** Applies {@link pageCacheKey} to reads and writes, leaving every request whose key is its own URL untouched. */
export const documentCacheKey: SerwistPlugin = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const key = pageCacheKey(request);
    return key === request.url ? request : key;
  },
};

/** The document of the page an RSC request is for (same URL without `_rsc`), or null for any other request. */
export function documentUrlForRsc(request: Request): string | null {
  return isRscRequest(request) ? withoutRscParam(request.url) : null;
}

type FindDocument = (url: string) => Promise<Response | undefined>;

/**
 * When an RSC request fails on the network and `tv-pages` has no payload for it, answers with the saved document of
 * the same page. Next treats a non-RSC answer as "load this page in full", and that full load is then served from the
 * cache: a soft navigation to a page visited only by full loads still works offline. Without a saved document the
 * failure goes through. Only `handlerDidError`: a response that arrived, of any status, is never touched.
 */
export function rscDocumentFallback(findDocument: FindDocument): SerwistPlugin {
  return {
    handlerDidError: async ({ request }) => {
      const documentUrl = documentUrlForRsc(request);
      if (!documentUrl) return undefined;
      const document = await findDocument(documentUrl);
      if (!document?.headers.get('Content-Type')?.startsWith('text/html')) return undefined;
      return document;
    },
  };
}

/**
 * The saved document of a page: the copy in `pagesCache`, else, for `/` and `/minha-lista`, the precached one (looked up
 * by path: the precache holds each page once, whatever the query).
 */
export function savedDocument(pagesCache: string, matchPrecache: FindDocument): FindDocument {
  return async (url) => {
    const saved = await (await caches.open(pagesCache)).match(url);
    if (saved) return saved;
    const { pathname } = new URL(url);
    return isPrecachedPagePath(pathname) ? matchPrecache(pathname) : undefined;
  };
}

/**
 * For the network-first route of the precached pages: when both the network and `tv-pages` fail, the precached copy,
 * which nothing evicts. Their latest online copy (in `tv-pages`) still wins while it lasts.
 */
export function precachedPageFallback(matchPrecache: FindDocument): SerwistPlugin {
  return { handlerDidError: async ({ request }) => matchPrecache(new URL(request.url).pathname) };
}

/**
 * Fetches a TMDb image in CORS mode (its CDN answers `Access-Control-Allow-Origin: *`), so the cache stores a readable
 * response. A plain `<img>` asks in no-cors mode, and an opaque response cannot be checked and counts as several MB
 * against the storage quota.
 */
export const corsImageRequest: SerwistPlugin = {
  requestWillFetch: async ({ request }) =>
    request.mode === 'cors' ? request : new Request(request.url, { mode: 'cors', credentials: 'omit' }),
};
