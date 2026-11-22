'use client';

import { useEffect, useState } from 'react';
import { useOptionalLibraryRepository } from './LibraryProvider';
import type { LibraryQueue } from './repository';

/**
 * How many of this account's actions wait in the offline queue, kept current as this tab or another one queues,
 * undoes or sends them. 0 for a visitor, without the on-device store, and outside a LibraryProvider.
 */
export function useQueueStatus(): { queued: number } {
  const queue = useOptionalLibraryRepository()?.queue;
  const [count, setCount] = useState<{ queue: LibraryQueue | undefined; queued: number }>({ queue, queued: 0 });

  useEffect(() => {
    if (!queue) return;
    let alive = true;
    // Only the latest read counts: an older answer may arrive after a newer one.
    let reads = 0;
    const refresh = () => {
      const read = ++reads;
      void queue.count().then((queued) => {
        if (alive && read === reads) setCount({ queue, queued });
      });
    };
    refresh();
    const stop = queue.subscribe(refresh);
    return () => {
      alive = false;
      stop();
    };
  }, [queue]);

  // A count read for the previous identity's queue never shows for the next one.
  return { queued: count.queue === queue ? count.queued : 0 };
}
