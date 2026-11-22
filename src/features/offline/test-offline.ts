import { act } from '@testing-library/react';
import { useSyncExternalStore } from 'react';

/**
 * A stand-in for `next/offline`, whose hook is always false outside a build with `experimental.useOffline`. Wire it
 * in a test file with:
 *   vi.mock('next/offline', async () => (await import('@/features/offline/test-offline')).offlineModule);
 * and call `resetOffline()` before each test.
 */
let offline = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const offlineModule = {
  useOffline: () =>
    useSyncExternalStore(
      subscribe,
      () => offline,
      () => false,
    ),
};

/** Flips the connection, re-rendering every component that reads it. */
export function setOffline(value: boolean) {
  act(() => {
    offline = value;
    listeners.forEach((listener) => listener());
  });
}

export function resetOffline() {
  offline = false;
}
