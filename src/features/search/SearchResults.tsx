'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { PosterCard } from '@/features/catalog/PosterCard';
import type { SearchItem } from '@/features/tmdb/types';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
import { fetchSearchPage } from './api';
import { PersonCard } from './PersonCard';
import { saveRecent } from './recent';

export type SearchTab = 'all' | 'movie' | 'tv' | 'person';

const MAX_PAGE = 500;

export function SearchResults({ query, tab }: { query: string; tab: SearchTab }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, isError, refetch } = useInfiniteQuery({
    queryKey: ['search-page', query],
    queryFn: ({ pageParam, signal }) => fetchSearchPage(query, pageParam, signal),
    initialPageParam: 1,
    staleTime: 60_000,
    getNextPageParam: (last) => (last.page < last.totalPages && last.page < MAX_PAGE ? last.page + 1 : undefined),
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages ?? [])
      .flatMap((p) => p.results)
      .filter((i) => {
        const key = `${i.mediaType}-${i.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return tab === 'all' || i.mediaType === tab;
      });
  }, [data, tab]);

  const sentinel = useRef<HTMLDivElement>(null);
  const canLoad = hasNextPage && !isFetchingNextPage && !isError;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canLoad || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canLoad, fetchNextPage, data?.pages.length]);

  if (isPending) return <ResultsSkeleton />;
  if (isError && !data) {
    return (
      <EmptyState
        title="Não foi possível buscar agora"
        action={<Button variant="ghost" onClick={() => void refetch()}>Tentar novamente</Button>}
      />
    );
  }
  if (items.length === 0 && !hasNextPage) return <EmptyState title={`Nada encontrado para "${query}"`} />;

  const render = (item: SearchItem, i: number) =>
    item.mediaType === 'person' ? <PersonCard person={item} /> : <PosterCard item={item} priority={i < 6} />;

  return (
    <div onClickCapture={() => saveRecent(query)}>
      <ul
        className={
          tab === 'person'
            ? 'grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
            : 'grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7'
        }
      >
        {items.map((item, i) => (
          <li key={`${item.mediaType}-${item.id}`}>{render(item, i)}</li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div className="mt-8 flex flex-col items-center gap-3 text-center" aria-live="polite">
        {isError ? <p role="alert" className="text-ivory-muted">Não foi possível carregar mais resultados.</p> : null}
        {hasNextPage ? (
          <Button variant="ghost" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Carregando…' : isError ? 'Tentar novamente' : 'Carregar mais'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <ul aria-hidden="true" className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
      {Array.from({ length: 14 }, (_, i) => (
        <li key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </li>
      ))}
    </ul>
  );
}
