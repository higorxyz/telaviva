'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
import { GRID_CLASS } from './GridSkeleton';
import { PosterCard } from './PosterCard';

const MAX_PAGE = 500;

function pageUrl(endpoint: string, page: number): URL {
  const path = `${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}`;
  return new URL(path, window.location.origin);
}

async function fetchPage(endpoint: string, page: number): Promise<Paginated<MediaSummary>> {
  const res = await fetch(pageUrl(endpoint, page));
  if (!res.ok) throw new Error(`Falha ao carregar a página ${page} (${res.status})`);
  return (await res.json()) as Paginated<MediaSummary>;
}

export function MediaGrid({
  endpoint,
  initialPage,
}: {
  endpoint: string;
  initialPage: Paginated<MediaSummary>;
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError } = useInfiniteQuery({
    queryKey: ['media-grid', endpoint],
    queryFn: ({ pageParam }) => fetchPage(endpoint, pageParam),
    initialPageParam: initialPage.page,
    initialData: { pages: [initialPage], pageParams: [initialPage.page] },
    staleTime: Infinity,
    getNextPageParam: (last) =>
      last.page < last.totalPages && last.page < MAX_PAGE ? last.page + 1 : undefined,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    return data.pages
      .flatMap((p) => p.results)
      .filter((m) => {
        const key = `${m.mediaType}-${m.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [data.pages]);

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
  }, [canLoad, fetchNextPage, data.pages.length]);

  if (items.length === 0 && !hasNextPage) {
    return <EmptyState title="Nada por aqui ainda." description="Volte mais tarde para ver novos títulos." />;
  }

  return (
    <div>
      <ul className={GRID_CLASS}>
        {items.map((item, i) => (
          <li key={`${item.mediaType}-${item.id}`}>
            {/* First row (up to 8 columns) loads eagerly; only the first poster, the likely LCP, gets high priority. */}
            <PosterCard item={item} priority={i < 8} lcp={i === 0} />
          </li>
        ))}
        {isFetchingNextPage
          ? Array.from({ length: 12 }, (_, i) => (
              <li key={`sk-${i}`} aria-hidden="true">
                <Skeleton className="aspect-[2/3] w-full rounded-lg" />
                <Skeleton className="mt-2 h-4 w-3/4" />
              </li>
            ))
          : null}
      </ul>

      <div ref={sentinel} aria-hidden="true" className="h-px" />

      <div className="mt-8 flex flex-col items-center gap-3 text-center" aria-live="polite">
        {isError ? (
          <p role="alert" className="text-ivory-muted">
            Não foi possível carregar mais títulos.
          </p>
        ) : null}
        {hasNextPage ? (
          <Button variant="ghost" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Carregando…' : isError ? 'Tentar novamente' : 'Carregar mais'}
          </Button>
        ) : (
          <p className="font-display text-xl text-ivory-muted">Você chegou ao fim</p>
        )}
      </div>
    </div>
  );
}
