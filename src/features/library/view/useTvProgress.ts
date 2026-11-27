'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLibraryIdentity } from '../LibraryProvider';
import type { TvProgressInfo } from '../progress';
import { readSavedProgress, saveProgress } from './saved-progress';

const BATCH = 40;
const STALE_MS = 5 * 60 * 1000;
const NONE: Record<string, TvProgressInfo> = {};

/** Answers read from the device copy: stale at once, so the server is asked again when the connection returns. */
const deviceAnswers = new WeakSet<object>();

async function fetchBatch(ids: number[]): Promise<Record<string, TvProgressInfo>> {
  const res = await fetch(`/api/tv/progress?ids=${ids.join(',')}`);
  // Throw on any non-OK (a 429 included) so nothing is cached as success and the previous data stays.
  if (!res.ok) throw new Error(`tv progress ${res.status}`);
  return (await res.json()) as Record<string, TvProgressInfo>;
}

async function fetchProgress(ids: number[]): Promise<Record<string, TvProgressInfo>> {
  const batches: number[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
  const parts = await Promise.all(batches.map(fetchBatch));
  return Object.assign({}, ...parts) as Record<string, TvProgressInfo>;
}

/**
 * TMDb data series progress is derived from, in batches of 40. A failed request throws inside the query (one
 * retry), so the previous answer is kept and no failure is cached as success; with no data at all the hook returns an
 * empty map and consumers fall back to years / hide the rail. A changed id set keeps the previous answer until the
 * new one arrives, so "Continue assistindo" never blinks out.
 *
 * Offline: each answer is also kept on the device for the current identity (saved-progress.ts). When the request
 * fails for lack of network (fetch rejects; an HTTP error does not count), the kept progress of these series for this
 * identity answers instead, and is asked for again as soon as the connection returns. The query runs even while
 * TanStack believes the app is offline (`offlineFirst`), which would otherwise pause it before the device copy is read.
 */
export function useTvProgress(tvIds: number[]): Record<string, TvProgressInfo> {
  const ids = [...new Set(tvIds)].sort((a, b) => a - b);
  const identity = useLibraryIdentity();
  // An answer arriving after this identity left the screen (sign-out wipes its copy) is not kept.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { data } = useQuery({
    queryKey: ['tv-progress', ...ids],
    queryFn: async () => {
      let answer: Record<string, TvProgressInfo>;
      try {
        answer = await fetchProgress(ids);
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        const saved = await readSavedProgress(identity, ids);
        if (!saved) throw error;
        deviceAnswers.add(saved);
        return saved;
      }
      if (mounted.current) void saveProgress(identity, answer);
      return answer;
    },
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    retry: 1,
    networkMode: 'offlineFirst',
    staleTime: (query) => (query.state.data && deviceAnswers.has(query.state.data) ? 0 : STALE_MS),
  });
  // keepPreviousData only bridges the pending state: once the new id set's query errors, `data` is undefined. So the
  // last good answer is held here (state adjusted during render) and still shown after a failure.
  const [lastGood, setLastGood] = useState<Record<string, TvProgressInfo> | undefined>(undefined);
  if (data && data !== lastGood) setLastGood(data);
  return data ?? lastGood ?? NONE;
}
