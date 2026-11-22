import { CacheFirst, ExpirationPlugin, NetworkFirst, type RouteMatchCallback, type RuntimeCaching } from 'serwist';
import { corsImageRequest, documentCacheKey } from './plugins';

export const CACHE_NAMES = {
  pages: 'tv-pages',
  staticReserve: 'tv-static-reserve',
  catalog: 'tv-catalog-api',
  images: 'tv-images',
} as const;

const DAY = 24 * 60 * 60;

export const STATIC_RESERVE_LIMITS = { maxEntries: 400, maxAgeSeconds: 30 * DAY };

/** Header of a page warm-up: a plain fetch (no RSC header) that `tv-pages` stores like a visit. */
export const WARM_HEADER = 'X-TelaViva-Warm';

/** Pages stored in `tv-pages` when the worker installs, so they open offline even before a first visit. */
export const INSTALL_PAGES = ['/', '/minha-lista'];

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

/** A page of the site: a navigation, an RSC payload or a warm-up fetch. */
const isPage: RouteMatchCallback = ({ url, request, sameOrigin }) =>
  sameOrigin &&
  !NOT_PAGES.some((base) => isUnder(url.pathname, base)) &&
  (request.mode === 'navigate' || request.headers.get('RSC') === '1' || request.headers.get(WARM_HEADER) === '1');

/** Documents and RSC payloads of visited pages. The worker adds the RSC → document fallback to it (sw.ts). */
export const pagesStrategy = new NetworkFirst({
  cacheName: CACHE_NAMES.pages,
  networkTimeoutSeconds: 3,
  plugins: [documentCacheKey, new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 14 * DAY })],
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
