'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useLibrary } from '../library/hooks';
import { useLibraryIdentity } from '../library/LibraryProvider';
import type { LibraryItem } from '../library/types';
import { useTvProgress } from '../library/view/useTvProgress';
import { readDeviceMeta, writeDeviceMeta } from './device-meta';
import {
  keepWarmEntries,
  parseLastWarm,
  planWarmUp,
  seriesToWarm,
  warmHeaders,
  warmKey,
  warmTargets,
  type WarmContext,
  type WarmStep,
} from './warm-watching';

const PENDING = 'pending';
const NO_ITEMS: LibraryItem[] = [];

/** Off under `next dev` (no worker) and with the emergency switch (worker removed): nothing would keep the answers. */
function warmUpDisabled(): boolean {
  return process.env.NEXT_PUBLIC_SW_DISABLED === '1' || process.env.NODE_ENV === 'development';
}

/**
 * Warm-ups run only while the app is on screen, online, not asked to save data, and with a worker controlling the page
 * (without one the answers would only reach the HTTP cache, which offline navigation does not use).
 */
function canWarmNow(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return (
    document.visibilityState === 'visible' &&
    navigator.onLine &&
    connection?.saveData !== true &&
    Boolean(navigator.serviceWorker?.controller)
  );
}

/** Fetches one series' URLs one after another, at low priority. True when every answer was OK. */
async function warmUrls(urls: string[], signal: AbortSignal): Promise<boolean> {
  let ok = true;
  for (const url of urls) {
    const response = await fetch(url, { priority: 'low', headers: warmHeaders(url), signal });
    // Read to the end, so the worker's copy is complete before the next request starts.
    await response.arrayBuffer();
    ok &&= response.ok;
  }
  return ok;
}

/** The plan's steps grouped by series, in order. */
function bySeries(plan: WarmStep[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const { key, url } of plan) groups.set(key, [...(groups.get(key) ?? []), url]);
  return [...groups];
}

/**
 * Saves the series due for it, one at a time, and records each one's time once all its answers were OK (a failed one
 * is tried again on the next run). Stops when aborted or when the conditions to warm no longer hold.
 */
async function runWarmUp(identity: string, items: LibraryItem[], context: WarmContext, signal: AbortSignal) {
  const metaKey = `warm:${identity}`;
  const stored = parseLastWarm(await readDeviceMeta(metaKey));
  let record = keepWarmEntries(stored, seriesToWarm(items).map((item) => warmKey(item.tmdbId)));
  for (const [key, urls] of bySeries(planWarmUp(items, stored, new Date().toISOString(), context))) {
    if (signal.aborted || !canWarmNow()) return;
    if (!(await warmUrls(urls, signal)) || signal.aborted) continue;
    record = { ...record, [key]: new Date().toISOString() };
    await writeDeviceMeta(metaKey, record);
  }
}

/**
 * Saves for offline, in the background, the series being watched (src/features/offline/warm-watching.ts): their pages
 * and current and next seasons, kept by the service worker. Best effort: never blocks rendering, swallows every error,
 * and stops on unmount or when the identity changes. Never runs while the identity is `pending`. Mount it once, inside
 * the library.
 */
export function useWarmWatching(): void {
  const identity = useLibraryIdentity();
  const { state } = useLibrary();
  const items = state?.items ?? NO_ITEMS;
  // Every series being watched, as the home rail asks: the same progress query serves both.
  const watchingIds = items.filter((i) => i.mediaType === 'tv' && i.status === 'watching').map((i) => i.tmdbId);
  const progress = useTvProgress(watchingIds);
  const context = useMemo<WarmContext>(() => ({ progress, episodes: state?.episodes ?? [] }), [progress, state]);
  // A run starts again only when what it would save changes, not on every library write.
  const signature = useMemo(
    () => warmTargets(items, context).map((target) => `${target.key}=${target.urls.join(',')}`).join('|'),
    [items, context],
  );
  const latest = useRef({ items, context });
  useEffect(() => {
    latest.current = { items, context };
  });

  useEffect(() => {
    if (warmUpDisabled() || identity === PENDING || signature === '') return;
    const controller = new AbortController();
    let running = false;
    const attempt = () => {
      if (running || controller.signal.aborted || !canWarmNow()) return;
      running = true;
      runWarmUp(identity, latest.current.items, latest.current.context, controller.signal)
        .catch(() => {})
        .finally(() => {
          running = false;
        });
    };
    attempt();
    document.addEventListener('visibilitychange', attempt);
    window.addEventListener('online', attempt);
    navigator.serviceWorker?.addEventListener('controllerchange', attempt);
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', attempt);
      window.removeEventListener('online', attempt);
      navigator.serviceWorker?.removeEventListener('controllerchange', attempt);
    };
  }, [identity, signature]);
}

/** {@link useWarmWatching} as an element, for the providers tree. Renders nothing. */
export function WarmWatching(): null {
  useWarmWatching();
  return null;
}
