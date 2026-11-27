import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshStore } from '@/features/library/test-library-server';
import { EMPTY_LIBRARY } from '@/features/library/types';
import type { OfflineStore } from '@/features/offline/store-types';
import { createDeviceSession } from './device-session';

let store: OfflineStore;
beforeEach(async () => {
  store = await freshStore();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createDeviceSession', () => {
  it('a store that could not open (blocked, say) is tried again on the next call, not given up for the page', async () => {
    await store.putSnapshot('ana', EMPTY_LIBRARY);
    const openStore = vi.fn<() => Promise<OfflineStore | null>>().mockResolvedValueOnce(null).mockResolvedValue(store);
    const device = createDeviceSession(openStore);

    expect(await device.lastUid()).toBeNull();
    await device.wipe('ana');

    expect(openStore).toHaveBeenCalledTimes(2);
    expect(await store.getSnapshot('ana')).toBeNull();
  });

  it('an open that throws is tried again too', async () => {
    await store.putSnapshot('ana', EMPTY_LIBRARY);
    const openStore = vi
      .fn<() => Promise<OfflineStore | null>>()
      .mockRejectedValueOnce(new Error('blocked'))
      .mockResolvedValue(store);
    const device = createDeviceSession(openStore);

    await device.dropCopy('ana');
    await device.dropCopy('ana');

    expect(await store.getSnapshot('ana')).toBeNull();
  });
});
