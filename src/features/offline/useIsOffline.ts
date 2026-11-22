'use client';

import { useOffline } from 'next/offline';
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/**
 * True while the app is offline. `useOffline` (next/offline) is the reliable signal, but it only turns on after an
 * `offline` event or a failed router fetch, so an app opened already offline would say nothing until a prefetch
 * fails. The browser's own `navigator.onLine === false` (a sure "offline"; `true` proves nothing) covers that cold
 * start. Both are false on the server and while hydrating, so the first paint never mismatches.
 */
export function useIsOffline(): boolean {
  const routerOffline = useOffline();
  const browserOffline = useSyncExternalStore(
    subscribe,
    () => navigator.onLine === false,
    () => false,
  );
  return routerOffline || browserOffline;
}
