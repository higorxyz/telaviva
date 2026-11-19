'use client';

import { useQuery } from '@tanstack/react-query';
import type { TvProgressInfo } from '../progress';

const BATCH = 40;
const NONE: Record<string, TvProgressInfo> = {};

async function fetchBatch(ids: number[]): Promise<Record<string, TvProgressInfo>> {
  try {
    const res = await fetch(`/api/tv/progress?ids=${ids.join(',')}`);
    return res.ok ? await res.json() : {};
  } catch {
    // TMDb or the network is down: the list still renders from its snapshots, just without progress.
    return {};
  }
}

/** TMDb data series progress is derived from, in batches of 40. Never errors: a failed batch is simply absent. */
export function useTvProgress(tvIds: number[]): Record<string, TvProgressInfo> {
  const ids = [...new Set(tvIds)].sort((a, b) => a - b);
  const { data } = useQuery({
    queryKey: ['tv-progress', ...ids],
    queryFn: async () => {
      const batches: number[][] = [];
      for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
      const parts = await Promise.all(batches.map(fetchBatch));
      return Object.assign({}, ...parts) as Record<string, TvProgressInfo>;
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? NONE;
}
