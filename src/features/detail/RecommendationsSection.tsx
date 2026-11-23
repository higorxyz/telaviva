import { Suspense } from 'react';
import { toCardItem } from '@/features/catalog/card-item';
import { Rail } from '@/features/catalog/Rail';
import { RailsSkeleton } from '@/features/catalog/RailsSkeleton';
import { getAvailableRecommendations } from '@/features/tmdb/recommendations';
import type { MediaSummary, MediaType } from '@/features/tmdb/types';

async function AvailableRecommendations({ media, id, items }: { media: MediaType; id: number; items: MediaSummary[] }) {
  const available = await getAvailableRecommendations(media, id, items);
  if (available.length === 0) return null;
  return <Rail id="recomendacoes" title={{ lead: 'Você também', accent: 'pode gostar' }} items={available.map(toCardItem)} />;
}

/**
 * "Você também pode gostar": screened for availability in Brazil behind Suspense, so the hero and the rest of the
 * page never wait on the provider lookups.
 */
export function RecommendationsSection({ media, id, items }: { media: MediaType; id: number; items: MediaSummary[] }) {
  if (items.length === 0) return null;
  return (
    <Suspense fallback={<RailsSkeleton count={1} />}>
      <AvailableRecommendations media={media} id={id} items={items} />
    </Suspense>
  );
}
