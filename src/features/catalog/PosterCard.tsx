import Link from 'next/link';
import type { ReactNode } from 'react';
import { posterSrcSet, tmdbImage } from '@/features/tmdb/images';
import type { MediaSummary } from '@/features/tmdb/types';
import { formatYear } from '@/lib/format';
import { mediaHref } from '@/lib/slug';
import { MediaBadge } from '@/ui/MediaBadge';
import { RatingRing } from '@/ui/RatingRing';

const DEFAULT_SIZES = '(min-width: 1536px) 12vw, (min-width: 1024px) 15vw, (min-width: 640px) 22vw, 30vw';

export function PosterCard({
  item,
  priority = false,
  sizes = DEFAULT_SIZES,
  subtitle,
  actions,
}: {
  item: MediaSummary;
  priority?: boolean;
  sizes?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const year = formatYear(item.releaseDate);
  const meta = subtitle ?? year;
  const src = tmdbImage(item.posterPath, 'w342');

  return (
    <div className="group relative">
      <Link
        href={mediaHref(item)}
        className="block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-ink-600 bg-ink-800 shadow-poster transition duration-300 group-hover:-translate-y-1 group-hover:border-amber group-hover:shadow-glow group-focus-within:-translate-y-1 group-focus-within:border-amber group-focus-within:shadow-glow motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-focus-within:translate-y-0">
          {src ? (
            <img
              src={src}
              srcSet={posterSrcSet(item.posterPath)}
              sizes={sizes}
              alt=""
              width={342}
              height={513}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div
              data-testid="poster-placeholder"
              className="grid size-full place-items-center bg-ink-800 p-3 text-center"
            >
              <span className="font-display text-xl leading-tight text-ivory-muted text-balance">
                {item.title}
              </span>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <MediaBadge mediaType={item.mediaType} />
          </div>
          <div className="absolute bottom-2 left-2">
            <RatingRing value={item.voteAverage} size="sm" />
          </div>
        </div>
        <div className="mt-2 px-0.5">
          <p className="line-clamp-2 font-sans text-sm font-medium text-ivory">{item.title}</p>
          {meta ? <p className="font-sans text-xs text-ivory-muted">{meta}</p> : null}
        </div>
      </Link>
      {actions ? <div className="absolute top-2 left-2">{actions}</div> : null}
    </div>
  );
}
