'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { MediaSummary } from '@/features/tmdb/types';
import { useLibrary } from './hooks';
import { itemKey } from './commands';
import { pickSeeds, type Seed } from './recommend';

const EMPTY: MediaSummary[] = [];

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

/** Stable across ordering: sorted seed keys with weights, plus the sorted exclusions. */
function hashOf(seeds: Seed[], exclude: string[]): string {
  const s = seeds.map((x) => `${itemKey(x)}@${x.weight}`).sort();
  return `${s.join(',')}|${[...exclude].sort().join(',')}`;
}

/** Recommendations from the library, weighted by ratings. Off until the library loads and has a positive seed. */
export function useRecommendations(): { items: MediaSummary[]; ready: boolean } {
  const { state, ready: libraryReady } = useLibrary();
  const input = useMemo(() => {
    if (!state) return null;
    const seeds = pickSeeds(state);
    const exclude = [...new Set([...state.items.map(itemKey), ...state.ratings.map(itemKey)])];
    return { seeds, exclude, hash: hashOf(seeds, exclude) };
  }, [state]);

  const query = useQuery({
    queryKey: ['recommendations', input?.hash ?? ''],
    queryFn: () => fetchRecommendations(input!.seeds, input!.exclude),
    enabled: libraryReady && !!input && input.seeds.some((s) => s.weight > 0),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  return query.isSuccess ? { items: query.data, ready: true } : { items: EMPTY, ready: false };
}
