import { useSyncExternalStore } from 'react';

const KEY = 'telaviva:discover-sidebar-collapsed';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Desktop sidebar collapsed flag, persisted in localStorage (a convenience only: failures are ignored). */
export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const set = (v: boolean) => {
    try {
      window.localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      // storage unavailable
    }
    listeners.forEach((l) => l());
  };
  return [collapsed, set];
}
