import type { ReactNode } from 'react';

/**
 * Slow vertical drift of the hero backdrop as the page scrolls (40px over the first 700px), driven by a CSS scroll
 * timeline (`.parallax-drift` in globals.css) on the compositor: no script, no scroll listener, nothing to hydrate.
 * Static where scroll timelines are unsupported and under prefers-reduced-motion.
 */
export function ParallaxBackdrop({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="parallax-drift absolute inset-x-0 -top-10 -bottom-2">
      {children}
    </div>
  );
}
