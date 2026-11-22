'use client';

import { Button } from '@/ui/Button';

/** Loads the page again: the address bar still holds the page that failed, not the offline page. */
export function RetryButton() {
  return (
    <Button variant="primary" onClick={() => window.location.reload()}>
      Tentar de novo
    </Button>
  );
}
