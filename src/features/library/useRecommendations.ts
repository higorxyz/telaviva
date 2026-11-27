'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { mediaKey } from '@/features/catalog/media-key';
import type { MediaSummary } from '@/features/tmdb/types';
import { itemKey } from './commands';
import { useLibrary } from './hooks';
import { MAX_EXCLUDE_KEYS, pickSeeds, type Seed } from './recommend';
import type { LibraryState } from './types';

const OFF = { items: [] as MediaSummary[], total: 0, ready: false } as const;

async function fetchRecommendations(seeds: Seed[], exclude: string[]): Promise<MediaSummary[]> {
  const res = await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seeds, exclude }),
  });
  if (!res.ok) throw new Error(`Recommendations request failed: ${res.status}`);
  const body = (await res.json()) as { results: MediaSummary[] };
  return body.results;
}

/** Stable across ordering: sorted seed keys with their weights. */
function hashOf(seeds: Seed[]): string {
  return seeds
    .map((x) => `${itemKey(x)}@${x.weight}`)
    .sort()
    .join(',');
}

/** Every title the library knows (items and ratings), the most recently touched first. */
function libraryKeys(state: LibraryState): string[] {
  const touched = [...state.items, ...state.ratings]
    .map((entry) => ({ key: itemKey(entry), at: Date.parse(entry.updatedAt) || 0 }))
    .sort((a, b) => b.at - a.at);
  return [...new Set(touched.map((t) => t.key))];
}

/**
 * Recommendations from the library, weighted by ratings. Off until the library loads and has a positive seed.
 *
 * The query is keyed by the seeds only. Saving a title (even from the rail itself) does not refetch nor blank the
 * rail: the titles already in the library are hidden here, and a seed change keeps the previous results on screen
 * until the new ones arrive. The server gets the 500 most recent keys (its limit); older ones are hidden here too.
 * `total` is the size of the server's answer, before that local filter.
 */
export function useRecommendations(): { items: MediaSummary[]; total: number; ready: boolean } {
  const { state, ready: libraryReady } = useLibrary();
  const input = useMemo(() => {
    if (!state) return null;
    const seeds = pickSeeds(state);
    const known = libraryKeys(state);
    return { seeds, known, hash: hashOf(seeds) };
  }, [state]);

  const enabled = libraryReady && !!input && input.seeds.some((s) => s.weight > 0);
  const query = useQuery({
    queryKey: ['recommendations', input?.hash ?? ''],
    queryFn: () => fetchRecommendations(input!.seeds, input!.known.slice(0, MAX_EXCLUDE_KEYS)),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const data = query.data;
  const known = input?.known;
  const items = useMemo(() => {
    if (!data || !known) return OFF.items;
    const hidden = new Set(known);
    return data.filter((media) => !hidden.has(mediaKey(media)));
  }, [data, known]);

  if (!enabled || !data) return OFF;
  return { items, total: data.length, ready: true };
}
