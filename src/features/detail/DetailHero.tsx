import type { ReactNode } from 'react';
import { backdropSrcSet, posterSrcSet, tmdbImage } from '@/features/tmdb/images';
import type { MediaSummary } from '@/features/tmdb/types';
import { cn } from '@/lib/cn';
import { AccentTitle } from '@/ui/AccentTitle';
import { PAGE_CONTAINER } from '@/ui/container';
import { Letterbox } from '@/ui/Letterbox';

type HeroSource = Pick<MediaSummary, 'title' | 'posterPath' | 'backdropPath'>;

function Poster({ item }: { item: HeroSource }) {
  const src = tmdbImage(item.posterPath, 'w500');
  return (
    <div className="aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-lg border border-ink-600 bg-ink-800 shadow-poster sm:w-44 md:w-64 lg:w-72">
      {src ? (
        <img
          src={src}
          srcSet={posterSrcSet(item.posterPath)}
          sizes="(min-width: 1024px) 18rem, (min-width: 768px) 16rem, 9rem"
          alt={`Pôster de ${item.title}`}
          width={500}
          height={750}
          fetchPriority="high"
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

/** Backdrop + letterbox + gradients; poster beside the text on desktop, over the bottom gradient on mobile. */
export function DetailHero({
  item,
  meta,
  actions,
}: {
  item: HeroSource;
  meta: ReactNode;
  actions?: ReactNode;
}) {
  const backdrop = tmdbImage(item.backdropPath, 'w1280');
  return (
    <section aria-label={`Sobre ${item.title}`} className="relative isolate overflow-hidden bg-ink-950">
      {backdrop ? (
        <img
          src={backdrop}
          srcSet={backdropSrcSet(item.backdropPath)}
          sizes="100vw"
          alt=""
          decoding="async"
          className="absolute inset-0 -z-10 size-full object-cover object-top"
        />
      ) : null}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-ink-950 via-ink-950/60 to-ink-950/10 max-md:hidden" />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-ink-950 via-ink-950/70 to-ink-950/20 md:via-ink-950/30 md:to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-ink-950/70 to-transparent" />
      <Letterbox />
      <div
        className={cn(
          PAGE_CONTAINER,
          'relative flex min-h-[30rem] flex-col justify-end gap-6 pt-28 pb-8 md:min-h-[34rem] md:flex-row md:items-end md:gap-10 md:pt-40 md:pb-14',
        )}
      >
        <Poster item={item} />
        <div className="animate-fade-up max-w-3xl motion-reduce:animate-none">
          <AccentTitle as="h1" text={item.title} className="text-4xl leading-[1.02] sm:text-5xl md:text-6xl" />
          {meta}
          {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}
