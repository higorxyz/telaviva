import type { MediaType } from '@/features/tmdb/types';
import { Skeleton } from '@/ui/Skeleton';
import { dedupeRails, PER_RAIL, type RailInput } from './rails';
import { CATALOG_LISTS } from './lists';
import { Rail } from './Rail';

/** One rail per list of this media, in CATALOG_LISTS order; a failing list only drops its own rail. */
export async function HubRails({ media }: { media: MediaType }) {
  const lists = Object.entries(CATALOG_LISTS).filter(([, list]) => list.media === media);
  const settled = await Promise.allSettled(lists.map(([, list]) => list.fetch(1)));
  const rails: RailInput[] = [];
  settled.forEach((result, i) => {
    const [id, list] = lists[i]!;
    if (result.status === 'rejected') {
      console.error(`[hub] list "${id}" dropped:`, result.reason);
      return;
    }
    rails.push({ id: id.replace('/', '-'), title: list.title, href: `/${id}`, items: result.value.results });
  });
  return (
    <>
      {dedupeRails(rails, { perRail: PER_RAIL }).map((rail, i) => (
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
