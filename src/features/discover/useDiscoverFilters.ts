'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { pruneUnknown } from './chips';
import { filtersToSearchParams, parseFilters, type DiscoverFilters } from './filters';
import type { DiscoverCatalog } from './labels';

/** Rapid toggles (several genres in a row) settle into one request. */
export const APPLY_DELAY_MS = 250;

const canon = (f: DiscoverFilters) => filtersToSearchParams(f).toString();
const normalize = (f: DiscoverFilters) => parseFilters(filtersToSearchParams(f));

/**
 * Filters mirrored in the URL, applied as you pick. `filters` is what the controls and chips show (it changes at
 * once); `applied` drives the results and follows after APPLY_DELAY_MS, or at once with `{ now: true }`.
 * The URL is written with history.replaceState (no RSC round trip, no history entry) and Next then updates
 * useSearchParams. We only re-parse when the URL *changes* to something we did not write ourselves
 * (back/forward), so the brief window where useSearchParams is still stale never reverts an apply.
 */
export function useDiscoverFilters(catalog: DiscoverCatalog) {
  const params = useSearchParams();
  const fromUrl = pruneUnknown(parseFilters(params), catalog);
  const urlKey = canon(fromUrl);
  const [applied, setApplied] = useState(fromUrl);
  const [filters, setFilters] = useState(fromUrl);
  const [urlSeen, setUrlSeen] = useState(urlKey);
  const [written, setWritten] = useState(urlKey);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const appliedRef = useRef(applied);

  if (urlKey !== urlSeen) {
    setUrlSeen(urlKey);
    if (urlKey !== written) {
      setWritten(urlKey);
      setApplied(fromUrl);
      setFilters(fromUrl);
    }
  }

  useEffect(() => {
    appliedRef.current = applied;
  }, [applied]);

  // Leaving the route hides it in an <Activity>: drop a pending apply (it would rewrite the next page's URL)
  // and show the applied state again when the route comes back.
  useLayoutEffect(() => {
    const pending = timer;
    const last = appliedRef;
    return () => {
      clearTimeout(pending.current);
      setFilters(last.current);
    };
  }, []);

  const apply = (input: DiscoverFilters) => {
    clearTimeout(timer.current);
    // Canonical form first (swapped years, clamped values...) so the grid key never changes twice.
    const f = normalize(input);
    const qs = canon(f);
    setWritten(qs);
    setApplied(f);
    setFilters(f);
    window.history.replaceState(null, '', qs ? `/descobrir?${qs}` : '/descobrir');
  };

  const update = (next: DiscoverFilters, options?: { now?: boolean }) => {
    if (options?.now) return apply(next);
    setFilters(next);
    clearTimeout(timer.current);
    const from = window.location.search;
    timer.current = setTimeout(() => {
      // A back/forward navigation in the meantime wins over the pending edit.
      if (window.location.search === from) apply(next);
    }, APPLY_DELAY_MS);
  };

  return { filters, applied, update };
}
