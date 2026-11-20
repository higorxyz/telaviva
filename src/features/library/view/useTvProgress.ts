'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { TvProgressInfo } from '../progress';

const BATCH = 40;
const NONE: Record<string, TvProgressInfo> = {};

async function fetchBatch(ids: number[]): Promise<Record<string, TvProgressInfo>> {
  const res = await fetch(`/api/tv/progress?ids=${ids.join(',')}`);
  // Throw on any non-OK (a 429 included) so nothing is cached as success and the previous data stays.
  if (!res.ok) throw new Error(`tv progress ${res.status}`);
  return (await res.json()) as Record<string, TvProgressInfo>;
}

/**
 * TMDb data series progress is derived from, in batches of 40. A failed request throws inside the query (one
 * retry), so the previous answer is kept and no failure is cached as success; with no data at all the hook returns an
 * empty map and consumers fall back to years / hide the rail. A changed id set keeps the previous answer until the
 * new one arrives, so "Continue assistindo" never blinks out.
 */
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
    placeholderData: keepPreviousData,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
  // keepPreviousData only bridges the pending state: once the new id set's query errors, `data` is undefined. So the
  // last good answer is held here (state adjusted during render) and still shown after a failure.
  const [lastGood, setLastGood] = useState<Record<string, TvProgressInfo> | undefined>(undefined);
  if (data && data !== lastGood) setLastGood(data);
  return data ?? lastGood ?? NONE;
}
