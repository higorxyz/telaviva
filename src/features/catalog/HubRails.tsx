import type { MediaType } from '@/features/tmdb/types';
import { EmptyState } from '@/ui/EmptyState';
import { Skeleton } from '@/ui/Skeleton';
import { dedupeRails, PER_RAIL, settleRails } from './rails';
import { CATALOG_LISTS } from './lists';
import { Rail } from './Rail';

/** One rail per list of this media, in CATALOG_LISTS order; a failing list only drops its own rail. */
export async function HubRails({ media }: { media: MediaType }) {
  const sources = Object.entries(CATALOG_LISTS)
    .filter(([, list]) => list.media === media)
    .map(([id, list]) => ({
      id: id.replace('/', '-'),
      title: list.title,
      href: `/${id}`,
      fetch: () => list.fetch(1),
    }));
  const rails = dedupeRails(await settleRails(sources, 'hub'), { perRail: PER_RAIL });
  if (rails.length === 0) {
    return (
      <EmptyState
        title="Nada por aqui agora"
        description="Não foi possível carregar os títulos neste momento. Tente novamente em instantes."
      />
    );
  }
  return (
    <>
      {rails.map((rail, i) => (
        <Rail key={rail.id} {...rail} priorityCount={i === 0 ? 2 : 0} />
      ))}
    </>
  );
}

export function HubSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-8 w-56" />
          <div className="flex gap-3 overflow-hidden sm:gap-4">
            {Array.from({ length: 8 }, (_, j) => (
              <Skeleton key={j} className="aspect-[2/3] w-[38vw] max-w-44 shrink-0 sm:w-36 lg:w-40" />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
