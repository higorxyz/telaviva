import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from 'serwist';
import { rscDocumentFallback } from './plugins';
import { CACHE_NAMES, INSTALL_PAGES, WARM_HEADER, pagesStrategy, runtimeCaching } from './rules';
import { keepPreviousBuildFiles } from './static-reserve';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Precached by the route (src/app/serwist/[path]/route.ts), shown when a page that was never saved opens offline. */
const OFFLINE_URL = '/~offline';

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

// After the constructor on purpose: Serwist only attaches the offline-page fallback above to strategies without a
// `handlerDidError` plugin. The two never overlap: one answers documents, the other RSC requests.
pagesStrategy.plugins.push(rscDocumentFallback(CACHE_NAMES.pages));

/** Stores the install pages through the pages strategy, as a visit would. Best effort: a failure leaves them out. */
function warmInstallPages(event: ExtendableEvent): Promise<unknown> {
  return Promise.allSettled(
    INSTALL_PAGES.map((path) => {
      const request = new Request(path, { headers: { [WARM_HEADER]: '1', Accept: 'text/html' } });
      return Promise.all(pagesStrategy.handleAll({ event, request }));
    }),
  );
}

// Registered before Serwist's own listeners; install only ends (and the worker activates) once both settle.
self.addEventListener('install', (event) => {
  event.waitUntil(Promise.allSettled([keepPreviousBuildFiles(serwist), warmInstallPages(event)]));
});

serwist.addEventListeners();
