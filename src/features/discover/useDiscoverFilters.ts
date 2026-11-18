'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { filtersToSearchParams, parseFilters, type DiscoverFilters } from './filters';

const canon = (f: DiscoverFilters) => filtersToSearchParams(f).toString();

/**
 * Filters mirrored in the URL. `applied` drives the results; `draft` is what the panel edits until "Aplicar".
 * The URL is written with history.replaceState (no RSC round trip, no history entry) and Next then updates
 * useSearchParams. We only re-parse when the URL *changes* to something we did not write ourselves
 * (back/forward), so the brief window where useSearchParams is still stale never reverts an apply.
 */
export function useDiscoverFilters() {
  const params = useSearchParams();
  const fromUrl = parseFilters(params);
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

  const apply = (f: DiscoverFilters) => {
    const qs = canon(f);
    setWritten(qs);
    setApplied(f);
    setDraft(f);
    window.history.replaceState(null, '', qs ? `/descobrir?${qs}` : '/descobrir');
  };

  return { applied, draft, setDraft, apply };
}
