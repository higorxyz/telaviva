import { useMemo, useSyncExternalStore } from 'react';

const KEY = 'telaviva:recent-searches';
const MAX_RECENT = 8;
const EMPTY = '[]';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function getRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function parse(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function readRecent(): string[] {
  return parse(getRaw());
}

function write(list: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable (private mode, quota): recents are a convenience only.
  }
  notify();
}

/** Saves a search at the front, dedupes case-insensitively, keeps at most 8. */
export function saveRecent(term: string): void {
  const clean = term.trim();
  if (!clean) return;
  write([clean, ...readRecent().filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT));
}

export function clearRecent(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Recent searches; empty on the server and during hydration, then live from localStorage. */
export function useRecentSearches(): string[] {
  const raw = useSyncExternalStore(subscribe, getRaw, () => EMPTY);
  return useMemo(() => parse(raw), [raw]);
}
