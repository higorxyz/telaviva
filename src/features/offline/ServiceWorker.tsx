'use client';

import { SerwistProvider, useSerwist } from '@serwist/turbopack/react';
import { useEffect, type ReactNode } from 'react';

/** Caches this site's worker creates: its own `tv-*` and Serwist's precache (`serwist-*`). */
const OWN_CACHE_PREFIXES = ['tv-', 'serwist-'];

/** Unregisters every worker of this site and deletes its caches, leaving any other cache alone. */
async function removeServiceWorker(): Promise<void> {
  const registrations = (await navigator.serviceWorker?.getRegistrations()) ?? [];
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => OWN_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix))).map((name) => caches.delete(name)),
  );
}

/**
 * Registers the worker the provider created (none when it is off). Done here rather than by the provider, which leaves
 * a failure unhandled: registration fails where workers are unavailable or blocked (some private modes, Playwright's
 * `serviceWorkers: 'block'`), and the site works the same without one.
 */
function Registration() {
  const { serwist } = useSerwist();
  useEffect(() => {
    serwist?.register().catch(() => {});
  }, [serwist]);
  return null;
}

/**
 * Registers the offline worker (`/serwist/sw.js`, the whole site in scope). Off under `next dev`, where a worker
 * would serve stale files, and with the emergency switch `NEXT_PUBLIC_SW_DISABLED=1`; both also remove a worker
 * registered earlier (a production run on the same port, or the deploy before the switch was flipped).
 */
export function ServiceWorker({ children }: { children: ReactNode }) {
  const disabled = process.env.NEXT_PUBLIC_SW_DISABLED === '1' || process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (disabled) removeServiceWorker().catch(() => {});
  }, [disabled]);

  return (
    // No reload on reconnect (it would drop what is on screen) and no caching of each URL the router pushes: pages
    // are cached as they load (src/sw/rules.ts).
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={disabled}
      register={false}
      cacheOnNavigation={false}
      reloadOnOnline={false}
    >
      <Registration />
      {children}
    </SerwistProvider>
  );
}
