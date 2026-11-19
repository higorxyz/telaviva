'use client';

import { useQuery } from '@tanstack/react-query';
import { MediaGrid } from '@/features/catalog/MediaGrid';
import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { GridSkeleton } from '@/features/catalog/GridSkeleton';
import { filtersToSearchParams, type DiscoverFilters } from './filters';

async function fetchFirst(qs: string): Promise<Paginated<MediaSummary>> {
  const res = await fetch(`/api/discover?${qs ? `${qs}&` : ''}page=1`);
  if (!res.ok) throw new Error(`Falha ao carregar os resultados (${res.status})`);
  return (await res.json()) as Paginated<MediaSummary>;
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
        <GridSkeleton count={16} />
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
            <button type="button" onClick={onClear} className="text-amber underline">
              Limpar filtros
            </button>
          ) : undefined
        }
      />
    );
  }
  return <MediaGrid key={qs} endpoint={`/api/discover?${qs}`} initialPage={data} />;
}
