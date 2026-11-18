import Link from 'next/link';
import { tmdbImage } from '@/features/tmdb/images';
import { mediaHref } from '@/lib/slug';
import { MediaBadge } from '@/ui/MediaBadge';
import type { FilmEntry } from './person';

export function FilmographyRow({ credit }: { credit: FilmEntry }) {
  const thumb = tmdbImage(credit.posterPath, 'w92');
  return (
    <li className="flex items-center gap-3 py-2">
      {thumb ? (
        <img src={thumb} alt="" width={92} height={138} loading="lazy" decoding="async" className="aspect-[2/3] w-9 shrink-0 rounded border border-ink-600 bg-ink-800 object-cover" />
      ) : (
        <div aria-hidden="true" data-testid="poster-placeholder" className="aspect-[2/3] w-9 shrink-0 rounded border border-ink-600 bg-ink-800" />
      )}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <Link
            href={mediaHref(credit)}
            className="rounded font-medium text-ivory hover:text-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            {credit.title}
          </Link>
          <MediaBadge mediaType={credit.mediaType} />
        </p>
        {credit.role ? <p className="text-sm text-ivory-muted">{credit.role}</p> : null}
      </div>
    </li>
  );
}
