'use client';

import { useQuery } from '@tanstack/react-query';
import type { SeasonDetails } from '@/features/tmdb/types';

async function fetchSeason(tvId: number, season: number): Promise<SeasonDetails> {
  const res = await fetch(`/api/tv/${tvId}/season/${season}`);
  if (!res.ok) throw new Error(`Season request failed: ${res.status}`);
  return res.json();
}

/** Details of one season (episode names), for the progress card. Off while `season` is null. */
export function useSeason(tvId: number, season: number | null) {
  return useQuery({
    queryKey: ['season', tvId, season],
    queryFn: () => fetchSeason(tvId, season as number),
    enabled: season !== null,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });
}
