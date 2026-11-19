'use client';

import { useLinkStatus } from 'next/link';

/**
 * Amber progress bar shown on a card while its uncached destination loads (detail routes have no loading.tsx,
 * so their 308/404 statuses stay real). Always rendered and fixed-size: only opacity changes, no layout shift.
 * The fade-in is delayed, so fast navigations never flash it.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      data-pending={pending || undefined}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left overflow-hidden opacity-0 data-pending:animate-pending-in"
    >
      <span className="block size-full animate-pulse bg-amber motion-reduce:animate-none" />
    </span>
  );
}
