import { cn } from '@/lib/cn';

const LAYER = 'pointer-events-none absolute';

/**
 * Overlays between a full-bleed backdrop and the text on it. The image itself is never filtered: darkness pools
 * only where text sits, so the top and right of the frame stay vivid while overlaid copy keeps 4.5:1 (3:1 for the
 * display title) even over a pure white frame. The page header brings its own top scrim.
 * `feature`: home hero, text bottom left. `detail`: title pages, poster plus a wide info column along the bottom.
 */
export function HeroScrims({ variant = 'feature' }: { variant?: 'feature' | 'detail' }) {
  return (
    <div aria-hidden="true">
      {/* v1's left-to-right shade, desktop only. */}
      <div className={cn(LAYER, 'inset-0 bg-linear-to-r from-ink-950/80 via-ink-950/40 to-transparent max-md:hidden')} />
      {variant === 'feature' ? (
        <>
          <div
            className={cn(
              LAYER,
              'inset-0 bg-radial-[ellipse_at_0%_100%] from-ink-950/55 via-ink-950/40 via-40% to-transparent to-65% max-md:hidden',
            )}
          />
          <div className={cn(LAYER, 'inset-0 bg-linear-to-t from-ink-950 via-ink-950/80 via-45% to-transparent to-75% md:hidden')} />
        </>
      ) : (
        <div
          className={cn(
            LAYER,
            'inset-0 bg-linear-to-t from-ink-950/90 via-ink-950/75 via-45% to-transparent to-85% md:from-ink-950/85 md:via-ink-950/60 md:via-35% md:to-70%',
          )}
        />
      )}
      {/* Soft fade into the page, never a hard band. */}
      <div className={cn(LAYER, 'inset-x-0 bottom-0 h-44 bg-linear-to-t from-ink-950 to-transparent')} />
    </div>
  );
}
