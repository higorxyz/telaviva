'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { SearchItem } from '@/features/tmdb/types';
import { fetchSearchPage } from './api';
import { normalizeQuery } from './query';

export type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export function useSearch(
  query: string,
  opts: { debounceMs?: number } = {},
): { results: SearchItem[]; status: SearchStatus; isFetching: boolean } {
  const { debounceMs = 250 } = opts;
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(id);
  }, [query, debounceMs]);

  const normalized = normalizeQuery(debounced);
  const pending = normalizeQuery(query) !== null && normalizeQuery(query) !== normalized;

  const { data, isError, isFetching, isPending, isPlaceholderData } = useQuery({
    queryKey: ['search', normalized],
    queryFn: ({ signal }) => fetchSearchPage(normalized as string, 1, signal),
    enabled: normalized !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  if (normalized === null && !pending) return { results: [], status: 'idle', isFetching: false };
  const status: SearchStatus = isError ? 'error' : data && !pending && !isPending && !isPlaceholderData ? 'success' : 'loading';
  return { results: data?.results ?? [], status, isFetching: isFetching || pending };
}
