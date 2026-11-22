import { Route, Serwist, type PrecacheEntry, type SerwistGlobalConfig } from 'serwist';
import { precachedPageFallback, rscDocumentFallback, savedDocument } from './plugins';
import { OFFLINE_URL } from './precached-pages';
import { CACHE_NAMES, isPrecachedPageRequest, pagesStrategy, precachedPagesStrategy, runtimeCaching } from './rules';
import { keepPreviousBuildFiles } from './static-reserve';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// The precache list (self.__SW_MANIFEST) holds the build files, the offline page, `/` and `/minha-lista`
// (src/app/serwist/[path]/route.ts).
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // A new version takes over at once; the next navigation fetches fresh HTML (network first), and the static
  // reserve keeps the previous build's files for tabs opened before it.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: OFFLINE_URL, matcher: ({ request }) => request.destination === 'document' }],
  },
});

const matchPrecache = (url: string) => serwist.matchPrecache(url);

// After the constructor on purpose: Serwist only attaches the offline-page fallback above to strategies without a
// `handlerDidError` plugin. The two never overlap: one answers documents, the other RSC requests.
pagesStrategy.plugins.push(rscDocumentFallback(savedDocument(CACHE_NAMES.pages, matchPrecache)));
precachedPagesStrategy.plugins.push(precachedPageFallback(matchPrecache));

// Navigations to the precached pages go network first, ahead of the precache route (the constructor registers it
// first, and it would always answer from the precache). Routes are tried in order, so this one moves to the front.
serwist.registerRoute(new Route(isPrecachedPageRequest, precachedPagesStrategy, 'GET'));
const getRoutes = serwist.routes.get('GET')!;
getRoutes.unshift(getRoutes.pop()!);

// Next to Serwist's own install listener: install only ends (and the worker activates) once the copy settles, so it
// reads the old precache entries before activation drops them.
self.addEventListener('install', (event) => {
  event.waitUntil(keepPreviousBuildFiles(serwist).catch(() => {}));
});

serwist.addEventListeners();
