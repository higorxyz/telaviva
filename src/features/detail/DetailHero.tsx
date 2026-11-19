import type { ReactNode } from 'react';
import { backdropSrcSet, posterSrcSet, tmdbImage } from '@/features/tmdb/images';
import type { MediaSummary } from '@/features/tmdb/types';
import { cn } from '@/lib/cn';
import { BackButton } from './BackButton';
import { AccentTitle } from '@/ui/AccentTitle';
import { PAGE_CONTAINER } from '@/ui/container';
import { EagerImage } from '@/ui/EagerImage';
import { HeroScrims } from '@/ui/HeroScrims';

type HeroSource = Pick<MediaSummary, 'title' | 'posterPath' | 'backdropPath'>;

function Poster({ item }: { item: HeroSource }) {
  const src = tmdbImage(item.posterPath, 'w500');
  return (
    <div className="aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-800 shadow-poster sm:w-44 md:w-64 lg:w-72">
      {src ? (
        <EagerImage
          src={src}
          srcSet={posterSrcSet(item.posterPath)}
          sizes="(min-width: 1024px) 18rem, (min-width: 768px) 16rem, (min-width: 640px) 11rem, 9rem"
          alt={`Pôster de ${item.title}`}
          width={500}
          height={750}
          decoding="async"
          className="size-full object-cover"
        />
      ) : (
        <div data-testid="poster-placeholder" className="grid size-full place-items-center p-4 text-center">
          <span className="font-display text-2xl leading-tight text-balance text-ivory-muted">{item.title}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Full-bleed backdrop (under the transparent header) with the poster at the container's left edge and the info
 * beside it on desktop; on mobile the poster sits above the info, over the bottom fade.
 */
export function DetailHero({
  item,
  backHref,
  meta,
  actions,
}: {
  item: HeroSource;
  backHref: string;
  meta: ReactNode;
  actions?: ReactNode;
}) {
  const backdrop = tmdbImage(item.backdropPath, 'w1280');
  return (
    // No overflow clipping (every layer is inset-0): the rating and status popovers open under their triggers and
    // may reach past the hero's bottom edge. z-10 keeps such a popover above the content that follows.
    <section aria-label={`Sobre ${item.title}`} className="relative isolate z-10 bg-ink-950">
      {backdrop ? (
        <EagerImage
          src={backdrop}
          srcSet={backdropSrcSet(item.backdropPath)}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-10 size-full object-cover object-top"
        />
      ) : null}
      <HeroScrims variant="detail" />
      {/* Below the 4rem fixed header, on the container's left edge. */}
      <div className={cn(PAGE_CONTAINER, 'absolute inset-x-0 top-[4.25rem] z-10 md:top-20')}>
        <BackButton fallbackHref={backHref} />
      </div>
      <div
        className={cn(
          PAGE_CONTAINER,
          // Column on mobile (bottom aligned); row from md, start aligned so the block hugs the container's left edge.
          'relative flex min-h-[30rem] flex-col justify-end gap-6 pt-36 pb-8 md:min-h-[38rem] md:flex-row md:items-end md:justify-start md:gap-10 md:pt-40 md:pb-14',
        )}
      >
        <Poster item={item} />
        <div className="animate-fade-up max-w-3xl min-w-0 motion-reduce:animate-none">
          <AccentTitle as="h1" text={item.title} className="text-4xl leading-[1.02] sm:text-5xl md:text-6xl" />
          {meta}
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
