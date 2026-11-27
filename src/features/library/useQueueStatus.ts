'use client';

import { useEffect, useState } from 'react';
import { useOptionalLibraryRepository } from './LibraryProvider';
import type { LibraryQueue } from './repository';

type Status = { queue: LibraryQueue | undefined; queued: number; stalled: boolean };

/**
 * How many of this account's actions wait in the offline queue, and whether the first one is stuck (it keeps failing
 * with a connection), kept current as this tab or another one queues, undoes, retries or sends them. 0 and false for
 * a visitor, without the on-device store, and outside a LibraryProvider.
 */
export function useQueueStatus(): { queued: number; stalled: boolean } {
  const queue = useOptionalLibraryRepository()?.queue;
  const [count, setCount] = useState<Status>({ queue, queued: 0, stalled: false });

  useEffect(() => {
    if (!queue) return;
    let alive = true;
    // Only the latest read counts: an older answer may arrive after a newer one.
    let reads = 0;
    const refresh = () => {
      const read = ++reads;
      const stalled = queue.stalled ? queue.stalled().catch(() => false) : Promise.resolve(false);
      void Promise.all([queue.count(), stalled]).then(([queued, stuck]) => {
        if (alive && read === reads) setCount({ queue, queued, stalled: queued > 0 && stuck });
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
  return count.queue === queue ? { queued: count.queued, stalled: count.stalled } : { queued: 0, stalled: false };
}
