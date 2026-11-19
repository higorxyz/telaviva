import Link from 'next/link';
import type { ReactNode } from 'react';
import { CardLibraryAction } from '@/features/library/CardLibraryAction';
import { posterSrcSet, tmdbImage } from '@/features/tmdb/images';
import type { MediaSummary } from '@/features/tmdb/types';
import { formatRating, formatYear } from '@/lib/format';
import { mediaHref } from '@/lib/slug';
import { MediaBadge } from '@/ui/MediaBadge';
import { RatingRing } from '@/ui/RatingRing';
import { GRID_SIZES } from './GridSkeleton';
import { LinkPending } from './LinkPending';

/** Screen-reader name that starts with the title: "Duna (2021) — Série — Nota 8,0". */
export function posterLabel(item: MediaSummary, meta: string | null): string {
  return [
    meta ? `${item.title} (${meta})` : item.title,
    item.mediaType === 'tv' ? 'Série' : null,
    item.voteAverage > 0 ? `Nota ${formatRating(Math.min(10, item.voteAverage))}` : null,
  ]
    .filter(Boolean)
    .join(' — ');
}

export function PosterCard({
  item,
  priority = false,
  lcp = false,
  sizes = GRID_SIZES,
  subtitle,
  actions,
  libraryAction = true,
  tabIndex,
  ringValue,
  ringTone = 'tmdb',
}: {
  item: MediaSummary;
  /** Loads eagerly (above-the-fold posters). */
  priority?: boolean;
  /** The page's likely LCP image: eager and fetched with high priority. At most one per page. */
  lcp?: boolean;
  sizes?: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Quick "Quero ver" icon on the poster. An explicit `actions` replaces it. */
  libraryAction?: boolean;
  /** Set by Rail for its roving tab stop. */
  tabIndex?: number;
  /** Value of the corner ring; defaults to the TMDb average. */
  ringValue?: number | null;
  ringTone?: 'tmdb' | 'personal';
}) {
  const year = formatYear(item.releaseDate);
  const meta = subtitle ?? year;
  const src = tmdbImage(item.posterPath, 'w342');
  const corner = actions ?? (libraryAction ? <CardLibraryAction item={item} /> : null);

  return (
    <div className="group relative">
      <Link
        href={mediaHref(item)}
        aria-label={posterLabel(item, meta)}
        tabIndex={tabIndex}
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
              loading={priority || lcp ? 'eager' : 'lazy'}
              fetchPriority={lcp ? 'high' : undefined}
              decoding="async"
              className="size-full object-cover"
            />
          ) : (
            <div
              data-testid="poster-placeholder"
              aria-hidden="true"
              className="grid size-full place-items-center bg-ink-800 p-3 text-center"
            >
              <span className="font-display text-xl leading-tight text-ivory-muted text-balance">{item.title}</span>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <MediaBadge mediaType={item.mediaType} />
          </div>
          <div className="absolute bottom-2 left-2">
            <RatingRing value={ringValue === undefined ? item.voteAverage : ringValue} size="sm" tone={ringTone} />
          </div>
          <LinkPending />
        </div>
        <div className="mt-2 px-0.5">
          <p className="line-clamp-2 font-sans text-sm font-medium text-ivory">{item.title}</p>
          {meta ? <p className="font-sans text-xs text-ivory-muted">{meta}</p> : null}
        </div>
      </Link>
      {/* Outside the link (valid HTML) but lifts with the card. Empty until the library is ready. */}
      {corner ? (
        <div className="absolute top-2 left-2 transition duration-300 group-hover:-translate-y-1 group-focus-within:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-focus-within:translate-y-0">
          {corner}
        </div>
      ) : null}
    </div>
  );
}
