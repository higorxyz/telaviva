'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { PosterCard } from '@/features/catalog/PosterCard';
import type { SearchItem } from '@/features/tmdb/types';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { GridSkeleton } from '@/features/catalog/GridSkeleton';
import { fetchSearchPage } from './api';
import { PersonCard } from './PersonCard';
import { saveRecent } from './recent';

export type SearchTab = 'all' | 'movie' | 'tv' | 'person';

const MAX_PAGE = 500;
const MEDIA_GRID = 'grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7';
const MAX_AUTO_LOADS = 3;

const EMPTY_COPY: Record<SearchTab, (q: string) => string> = {
  all: (q) => `Nada encontrado para "${q}"`,
  movie: (q) => `Nenhum filme encontrado para "${q}"`,
  tv: (q) => `Nenhuma série encontrada para "${q}"`,
  person: (q) => `Nenhuma pessoa encontrada para "${q}"`,
};

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

  // Auto-load only while the last page still added something to the active tab, and at most
  // MAX_AUTO_LOADS times in a row (until the sentinel leaves the viewport or the user asks for more).
  const lastPage = data?.pages.at(-1);
  const lastAdded = lastPage ? lastPage.results.filter((i) => tab === 'all' || i.mediaType === tab).length : 0;
  const sentinel = useRef<HTMLDivElement>(null);
  const autoLoads = useRef(0);
  const canAutoLoad = hasNextPage && !isFetchingNextPage && !isError && lastAdded > 0;

  useEffect(() => {
    autoLoads.current = 0;
  }, [query, tab]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canAutoLoad || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) {
          autoLoads.current = 0;
        } else if (autoLoads.current < MAX_AUTO_LOADS) {
          autoLoads.current += 1;
          void fetchNextPage();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [canAutoLoad, fetchNextPage, data?.pages.length]);

  const loadMore = () => {
    autoLoads.current = 0;
    void fetchNextPage();
  };

  if (isPending) return <GridSkeleton count={14} className={MEDIA_GRID} />;
  if (isError && !data) {
    return (
      <ErrorState
        title="Não foi possível buscar agora"
        description="Verifique sua conexão e tente de novo."
        onRetry={() => void refetch()}
      />
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title={EMPTY_COPY[tab](query)}
        description={hasNextPage ? 'Ainda há mais resultados em outras páginas.' : undefined}
        action={
          hasNextPage ? (
            <Button variant="ghost" onClick={loadMore} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
            </Button>
          ) : undefined
        }
      />
    );
  }

  const render = (item: SearchItem, i: number) =>
    item.mediaType === 'person' ? <PersonCard person={item} /> : <PosterCard item={item} priority={i < 6} />;

  return (
    <div
      onClickCapture={(e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('a')) saveRecent(query);
      }}
    >
      <ul
        className={
          tab === 'person'
            ? 'grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6'
            : MEDIA_GRID
        }
      >
        {items.map((item, i) => (
          <li key={`${item.mediaType}-${item.id}`}>{render(item, i)}</li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div className="mt-8 flex flex-col items-center gap-3 text-center" aria-live="polite">
        {isError ? <p className="text-ivory-muted">Não foi possível carregar mais resultados.</p> : null}
        {hasNextPage ? (
          <Button variant="ghost" onClick={loadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Carregando…' : isError ? 'Tentar novamente' : 'Carregar mais'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
