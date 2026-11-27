'use client';

import { useLinkStatus } from 'next/link';

/**
 * Amber progress bar shown on a card while its uncached destination loads (detail routes have no loading.tsx,
 * so their 308/404 statuses stay real). The slot is always rendered and absolutely positioned (no layout shift);
 * the animated bar only exists while pending, so idle cards run no animation at all. The fade-in is delayed,
 * so fast navigations never flash it.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden">
      {pending ? (
        <span
          data-testid="link-pending"
          className="block size-full animate-pending-in bg-amber opacity-0 motion-reduce:animate-none motion-reduce:opacity-100"
        />
      ) : null}
    </span>
  );
}
