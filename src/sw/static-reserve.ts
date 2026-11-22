import { CacheExpiration, type Serwist } from 'serwist';
import { CACHE_NAMES, STATIC_RESERVE_LIMITS } from './rules';

/** Build files still in the precache that the new precache list no longer has: the previous build's. */
export function previousBuildFiles(cachedUrls: string[], currentKeys: Set<string>): string[] {
  return cachedUrls.filter((url) => !currentKeys.has(url) && new URL(url).pathname.startsWith('/_next/static/'));
}

/**
 * Copies the previous build's files into `tv-static-reserve` before the new worker activates and Serwist drops them
 * from the precache, so a tab opened before the deploy can still load a chunk it has not loaded yet. Runs during
 * install, when the old entries are still there. Best effort: a failure only loses the copy.
 */
export async function keepPreviousBuildFiles(serwist: Serwist): Promise<void> {
  const precache = await caches.open(serwist.precacheStrategy.cacheName);
  const cachedUrls = (await precache.keys()).map((request) => request.url);
  const stale = previousBuildFiles(cachedUrls, new Set(serwist.getUrlsToPrecacheKeys().values()));
  if (stale.length === 0) return;

  const reserve = await caches.open(CACHE_NAMES.staticReserve);
  const expiration = new CacheExpiration(CACHE_NAMES.staticReserve, STATIC_RESERVE_LIMITS);
  for (const url of stale) {
    const response = await precache.match(url);
    if (!response) continue;
    await reserve.put(url, response);
    await expiration.updateTimestamp(url);
  }
  await expiration.expireEntries();
}
