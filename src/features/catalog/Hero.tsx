import type { Genre, MediaSummary, Video } from '@/features/tmdb/types';
import { backdropSrcSet, tmdbImage } from '@/features/tmdb/images';
import { formatRuntime, formatYear } from '@/lib/format';
import { mediaHref } from '@/lib/slug';
import { AccentTitle } from '@/ui/AccentTitle';
import { ButtonLink } from '@/ui/Button';
import { PAGE_CONTAINER } from '@/ui/container';
import { Letterbox } from '@/ui/Letterbox';
import { RatingRing } from '@/ui/RatingRing';
import { cn } from '@/lib/cn';
import { HeroTrailer } from '@/features/detail/HeroTrailer';
import { ParallaxBackdrop } from './ParallaxBackdrop';

export type HeroItem = MediaSummary & {
  runtime?: number | null;
  genres?: Genre[];
  trailer?: Video | null;
};

export const HERO_HEIGHT = 'h-[72svh] min-h-[28rem] md:h-[min(88svh,900px)]';

export function Hero({ item }: { item: HeroItem }) {
  const href = mediaHref(item);
  const year = formatYear(item.releaseDate);
  const runtime = formatRuntime(item.runtime ?? null);
  const genres = (item.genres ?? []).slice(0, 3).map((g) => g.name);
  const meta = [year, genres.join(', ') || null, runtime].filter(Boolean);
  const src = tmdbImage(item.backdropPath, 'w1280');

  return (
    <section aria-label="Em destaque" className={cn('relative isolate overflow-hidden bg-ink-950', HERO_HEIGHT)}>
      {src ? (
        <ParallaxBackdrop>
          <img
            src={src}
            srcSet={backdropSrcSet(item.backdropPath)}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="size-full object-cover object-top"
          />
        </ParallaxBackdrop>
      ) : null}
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-ink-950 via-ink-950/55 to-transparent max-md:hidden" />
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-ink-950 via-ink-950/50 to-transparent md:via-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-ink-950/70 to-transparent" />
      <Letterbox />
      <div className={cn(PAGE_CONTAINER, 'absolute inset-x-0 bottom-0 pb-10 md:pb-20')}>
        <div className="animate-fade-up max-w-2xl motion-reduce:animate-none">
          <p className="font-sans text-xs font-medium tracking-[0.2em] text-amber uppercase">Em destaque</p>
          <AccentTitle as="h1" text={item.title} className="mt-3 text-5xl leading-[1.02] md:text-7xl" />
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-sm text-ivory-muted">
            <RatingRing value={item.voteAverage} size="md" />
            {meta.map((part, i) => (
              <span key={part} className="flex items-center gap-3">
                {part}
                {/* Separator trails its item, so a wrapped line never starts with it. */}
                {i < meta.length - 1 ? <span aria-hidden="true">·</span> : null}
              </span>
            ))}
          </div>
          {item.overview ? (
            <p className="mt-4 line-clamp-2 max-w-xl font-sans text-base text-ivory/85 md:line-clamp-3">
              {item.overview}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {item.trailer ? (
              <HeroTrailer video={item.trailer} title={item.title} className="w-full sm:w-auto" />
            ) : null}
            <ButtonLink href={href} variant="ghost" size="lg" className="w-full sm:w-auto">
              Ver detalhes
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
