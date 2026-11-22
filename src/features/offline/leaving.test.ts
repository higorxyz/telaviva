import 'fake-indexeddb/auto';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshStore } from '../library/test-library-server';
import { readDeviceMeta, writeDeviceMeta } from './device-meta';
import { clearLeaving, isLeaving, markLeaving, onLeavingChange } from './leaving';
import type { OfflineStore } from './store-types';

let store: OfflineStore;
beforeEach(async () => {
  store = await freshStore();
});
afterEach(() => {
  clearLeaving('ana');
  vi.unstubAllGlobals();
});

/** What another tab posts on the channel. */
function fromAnotherTab(message: { uid: string; leaving: boolean }) {
  const channel = new BroadcastChannel('telaviva-leaving');
  channel.postMessage(message);
  channel.close();
}

describe('an identity signing out', () => {
  it('keeps nothing more on the device for it, while other identities still write', async () => {
    markLeaving('ana');
    await writeDeviceMeta('progress:ana', ['late']);
    await writeDeviceMeta('warm:ana', { 'tv:1': 'late' });
    await writeDeviceMeta('progress:bia', ['ok']);
    await writeDeviceMeta('progress:guest', ['ok']);
    expect(await store.getMeta('progress:ana')).toBeUndefined();
    expect(await store.getMeta('warm:ana')).toBeUndefined();
    expect(await readDeviceMeta('progress:bia')).toEqual(['ok']);
    expect(await readDeviceMeta('progress:guest')).toEqual(['ok']);
  });

  it('writes again once the same account signs in again', async () => {
    markLeaving('ana');
    clearLeaving('ana');
    await writeDeviceMeta('progress:ana', ['new session']);
    expect(await store.getMeta('progress:ana')).toEqual(['new session']);
  });

  it('is told to the other tabs, both the sign-out and the next sign-in', async () => {
    const changes = vi.fn();
    const stop = onLeavingChange(changes);
    fromAnotherTab({ uid: 'ana', leaving: true });
    await waitFor(() => expect(isLeaving('ana')).toBe(true));
    await writeDeviceMeta('progress:ana', ['late']);
    expect(await store.getMeta('progress:ana')).toBeUndefined();

    fromAnotherTab({ uid: 'ana', leaving: false });
    await waitFor(() => expect(isLeaving('ana')).toBe(false));
    expect(changes).toHaveBeenCalledTimes(2);
    stop();
  });

  it('ignores a malformed message', async () => {
    const changes = vi.fn();
    const stop = onLeavingChange(changes);
    const channel = new BroadcastChannel('telaviva-leaving');
    channel.postMessage({ uid: 7, leaving: 'yes' });
    channel.close();
    await new Promise((r) => setTimeout(r, 30));
    expect(changes).not.toHaveBeenCalled();
    stop();
  });
});
