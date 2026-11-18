'use client';

import { useQuery } from '@tanstack/react-query';
import { MediaGrid } from '@/features/catalog/MediaGrid';
import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';
import { filtersToSearchParams, type DiscoverFilters } from './filters';

async function fetchFirst(qs: string): Promise<Paginated<MediaSummary>> {
  const res = await fetch(`/api/discover?${qs ? `${qs}&` : ''}page=1`);
  if (!res.ok) throw new Error(`Falha ao carregar os resultados (${res.status})`);
  return (await res.json()) as Paginated<MediaSummary>;
}

function ResultsSkeleton() {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <li key={i}>
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </li>
      ))}
    </ul>
  );
}

/** First page is fetched here (one request per applied filter set); MediaGrid then paginates from it. */
export function DiscoverResults({ filters, onClear }: { filters: DiscoverFilters; onClear?: () => void }) {
  const qs = filtersToSearchParams(filters).toString();
  const { data, isError, isPending, refetch } = useQuery({
    queryKey: ['discover-first', qs],
    queryFn: () => fetchFirst(qs),
    staleTime: Infinity,
  });

  if (isPending) {
    return (
      <div role="status" aria-label="Carregando resultados">
        <ResultsSkeleton />
      </div>
    );
  }
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (data.results.length === 0) {
    return (
      <EmptyState
        title="Nada por aqui"
        description="Nenhum título atende a todos esses filtros. Tente afrouxar algum deles."
        action={
          onClear ? (
            <button type="button" onClick={onClear} className="text-amber underline underline-offset-4">
              Limpar filtros
            </button>
          ) : undefined
        }
      />
    );
  }
  return <MediaGrid key={qs} endpoint={`/api/discover?${qs}`} initialPage={data} />;
}
