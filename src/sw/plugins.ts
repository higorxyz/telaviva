import type { SerwistPlugin } from 'serwist';

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

/**
 * When an RSC request fails on the network and `tv-pages` has no payload for it, answers with the cached document of
 * the same page. Next treats a non-RSC answer as "load this page in full", and that full load is then served from the
 * cache: a soft navigation to a page visited only by full loads still works offline. Without a cached document the
 * failure goes through. Only `handlerDidError`: a response that arrived, of any status, is never touched.
 */
export function rscDocumentFallback(cacheName: string): SerwistPlugin {
  return {
    handlerDidError: async ({ request }) => {
      const documentUrl = documentUrlForRsc(request);
      if (!documentUrl) return undefined;
      const cache = await caches.open(cacheName);
      const document = await cache.match(documentUrl);
      if (!document?.headers.get('Content-Type')?.startsWith('text/html')) return undefined;
      return document;
    },
  };
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
