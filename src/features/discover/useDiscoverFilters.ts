'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { pruneUnknown } from './chips';
import { filtersToSearchParams, parseFilters, type DiscoverFilters } from './filters';
import type { DiscoverCatalog } from './labels';

const canon = (f: DiscoverFilters) => filtersToSearchParams(f).toString();
const normalize = (f: DiscoverFilters) => parseFilters(filtersToSearchParams(f));

/**
 * Filters mirrored in the URL. `applied` drives the results; `draft` is what the panel edits until "Aplicar".
 * The URL is written with history.replaceState (no RSC round trip, no history entry) and Next then updates
 * useSearchParams. We only re-parse when the URL *changes* to something we did not write ourselves
 * (back/forward), so the brief window where useSearchParams is still stale never reverts an apply.
 */
export function useDiscoverFilters(catalog: DiscoverCatalog) {
  const params = useSearchParams();
  const fromUrl = pruneUnknown(parseFilters(params), catalog);
  const urlKey = canon(fromUrl);
  const [applied, setApplied] = useState(fromUrl);
  const [draft, setDraft] = useState(fromUrl);
  const [urlSeen, setUrlSeen] = useState(urlKey);
  const [written, setWritten] = useState(urlKey);

  if (urlKey !== urlSeen) {
    setUrlSeen(urlKey);
    if (urlKey !== written) {
      setWritten(urlKey);
      setApplied(fromUrl);
      setDraft(fromUrl);
    }
  }

  const apply = (input: DiscoverFilters) => {
    // Canonical form first (swapped years, clamped values...) so the grid key never changes twice.
    const f = normalize(input);
    const qs = canon(f);
    setWritten(qs);
    setApplied(f);
    setDraft(f);
    window.history.replaceState(null, '', qs ? `/descobrir?${qs}` : '/descobrir');
  };

  const resetDraft = () => setDraft(applied);

  return { applied, draft, setDraft, apply, resetDraft };
}
