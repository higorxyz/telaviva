'use client';

import type { ImgHTMLAttributes } from 'react';

/**
 * An above-the-fold `<img>` rendered from the client tree. React turns every non-lazy `<img>` of a *server*
 * component into a preload hint in the RSC payload, so each prefetched route (the header's "Início", every
 * visible title card) made the current page download that route's hero backdrop, an `original` of up to a
 * few MB, plus its poster. From here the server render still emits the preload for a direct load (with the
 * same srcset and sizes, so the LCP candidate matches), while RSC prefetches fetch no images at all.
 */
export function EagerImage({ alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  return <img alt={alt} {...props} />;
}
