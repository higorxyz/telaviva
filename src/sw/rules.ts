import { CacheFirst, ExpirationPlugin, NetworkFirst, type RouteMatchCallback, type RuntimeCaching } from 'serwist';
import { corsImageRequest, documentCacheKey } from './plugins';
import { isPrecachedPagePath } from './precached-pages';
import { WARM_HEADER } from './warm-header';

export const CACHE_NAMES = {
  pages: 'tv-pages',
  staticReserve: 'tv-static-reserve',
  catalog: 'tv-catalog-api',
  images: 'tv-images',
} as const;

const DAY = 24 * 60 * 60;

export const STATIC_RESERVE_LIMITS = { maxEntries: 400, maxAgeSeconds: 30 * DAY };

export { WARM_HEADER };

/** Personal data, the sign-in proxy and the worker itself: never cached, never even answered by the worker. */
const PRIVATE_PREFIXES = ['/api/library', '/api/account', '/api/auth', '/__/auth/', '/serwist/'];

/** True for anything the worker must leave to the network: every non-GET and the private prefixes. */
export function isPrivateRequest(url: URL, method: string): boolean {
  return method !== 'GET' || PRIVATE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

const isUnder = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Wraps a matcher so it can never match a private request, whatever it checks. */
const publicOnly =
  (matcher: RouteMatchCallback): RouteMatchCallback =>
  (options) =>
    !isPrivateRequest(options.url, options.request.method) && matcher(options);

const isStaticFile: RouteMatchCallback = ({ url, sameOrigin }) =>
  sameOrigin && url.pathname.startsWith('/_next/static/');

const CATALOG_PATHS = ['/api/tv', '/api/catalog', '/api/discover', '/api/search'];

/** Public catalog data. `/api/tv/progress` is left out: its URL is the list of series, so it changes with the library. */
const isCatalogApi: RouteMatchCallback = ({ url: { pathname }, sameOrigin }) =>
  sameOrigin &&
  CATALOG_PATHS.some((base) => isUnder(pathname, base)) &&
  !isUnder(pathname, '/api/tv/progress');

const isTmdbImage: RouteMatchCallback = ({ url }) => url.origin === 'https://image.tmdb.org';

const NOT_PAGES = ['/api', '/_next', '/serwist'];

const isWarmUp = (request: Request) => request.headers.get(WARM_HEADER) === '1';

/**
 * A page of the site: a navigation, the RSC payload of a navigation or a warm-up fetch. RSC prefetches are left out:
 * every link on screen prefetches, and they would push the pages actually visited out of the cache.
 */
const isPage: RouteMatchCallback = ({ url, request, sameOrigin }) =>
  sameOrigin &&
  !NOT_PAGES.some((base) => isUnder(url.pathname, base)) &&
  (request.mode === 'navigate' ||
    (request.headers.get('RSC') === '1' && request.headers.get('Next-Router-Prefetch') !== '1') ||
    isWarmUp(request));

/** A navigation or warm-up of a precached page (`/`, `/minha-lista`), whatever the query. */
export const isPrecachedPageRequest: RouteMatchCallback = ({ url, request, sameOrigin }) =>
  sameOrigin &&
  request.method === 'GET' &&
  isPrecachedPagePath(url.pathname) &&
  (request.mode === 'navigate' || isWarmUp(request));

const pagePlugins = [documentCacheKey, new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 14 * DAY })];

/** Documents and RSC payloads of visited pages. The worker adds the RSC → document fallback to it (sw.ts). */
export const pagesStrategy = new NetworkFirst({
  cacheName: CACHE_NAMES.pages,
  networkTimeoutSeconds: 3,
  plugins: [...pagePlugins],
});

/**
 * The precached pages, network first like any page (fresh while online, their latest copy kept in `tv-pages`). The
 * worker adds the fallback to their precached copy and routes them ahead of the precache, which would answer cache
 * first (sw.ts).
 */
export const precachedPagesStrategy = new NetworkFirst({
  cacheName: CACHE_NAMES.pages,
  networkTimeoutSeconds: 3,
  plugins: [...pagePlugins],
});

/**
 * Only these requests are ever cached. Anything else, private requests and non-GETs included, matches no rule and goes
 * to the network as if there were no worker. Serwist's `defaultCache` is not used: it caches `/api/*`.
 */
export const runtimeCaching: RuntimeCaching[] = [
  {
    method: 'GET',
    matcher: publicOnly(isStaticFile),
    // Build files the precache does not hold: fonts, and the previous build's files kept for tabs opened before a
    // deploy (static-reserve.ts).
    handler: new CacheFirst({
      cacheName: CACHE_NAMES.staticReserve,
      plugins: [new ExpirationPlugin(STATIC_RESERVE_LIMITS)],
    }),
  },
  {
    method: 'GET',
    matcher: publicOnly(isCatalogApi),
    handler: new NetworkFirst({
      cacheName: CACHE_NAMES.catalog,
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: DAY })],
    }),
  },
  {
    method: 'GET',
    matcher: publicOnly(isTmdbImage),
    handler: new CacheFirst({
      cacheName: CACHE_NAMES.images,
      plugins: [
        corsImageRequest,
        new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true }),
      ],
    }),
  },
  { method: 'GET', matcher: publicOnly(isPage), handler: pagesStrategy },
];
