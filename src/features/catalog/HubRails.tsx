import type { MediaType } from '@/features/tmdb/types';
import { toCardItem } from './card-item';
import { HubGenres } from './HubGenres';
import { CATALOG_LISTS } from './lists';
import { Rail } from './Rail';
import { dedupeRails, PER_RAIL, requireRails, settleRails } from './rails';

/** One rail per list of this media, in CATALOG_LISTS order; a failing list only drops its own rail, all failing throws. */
export async function HubRails({ media }: { media: MediaType }) {
  const sources = Object.entries(CATALOG_LISTS)
    .filter(([, list]) => list.media === media)
    .map(([id, list]) => ({
      id: id.replace('/', '-'),
      title: list.title,
      href: `/${id}`,
      fetch: list.fetchRail,
    }));
  const rails = requireRails(dedupeRails(await settleRails(sources, 'hub'), { perRail: PER_RAIL }), 'hub');
  return (
    <>
      {rails.map((rail, i) => (
        <Rail key={rail.id} {...rail} items={rail.items.map(toCardItem)} priorityCount={i === 0 ? 2 : 0} />
      ))}
      <HubGenres media={media} />
    </>
  );
}
