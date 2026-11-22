/**
 * Pages in the worker's precache, so they always open offline: precache entries are never evicted. Read by the worker
 * and by the route that builds it (src/app/serwist/[path]/route.ts), so this file imports nothing.
 */

/** Shown when a page that was never saved opens offline. */
export const OFFLINE_URL = '/~offline';

/** Precached too, and served network first while online (src/sw/sw.ts). */
export const PRECACHED_PAGES = ['/', '/minha-lista'];

export const isPrecachedPagePath = (pathname: string) => PRECACHED_PAGES.includes(pathname);
