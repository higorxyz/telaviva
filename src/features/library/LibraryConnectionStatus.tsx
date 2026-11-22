'use client';

import { ConnectionStatus } from '@/features/offline/ConnectionStatus';
import { useQueueStatus } from './useQueueStatus';

/** The connection indicator, counting the signed-in account's queued actions. Mounted once, inside the library. */
export function LibraryConnectionStatus() {
  const { queued } = useQueueStatus();
  return <ConnectionStatus queued={queued} />;
}
