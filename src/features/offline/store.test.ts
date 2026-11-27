import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { item, NOW, want } from '../library/test-storage';
import type { LibraryState } from '../library/types';
import { OPEN_TIMEOUT_MS, openOfflineStore } from './store';
import type { OfflineStore, QueuedCommand } from './store-types';

const DAY = 86_400_000;
const state = (...ids: number[]): LibraryState => ({
  version: 1,
  items: ids.map((i) => item(i)) as unknown as LibraryState['items'],
  episodes: [],
  ratings: [],
});
const queued = (id: string, uid: string, tmdbId = 1, at = NOW): QueuedCommand => ({
  id,
  uid,
  command: want(tmdbId),
  at,
  attempts: 0,
});

let store: OfflineStore;

beforeEach(async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const opened = await openOfflineStore();
  if (!opened) throw new Error('store did not open');
  store = opened;
});
afterEach(() => vi.unstubAllGlobals());

/** Raw access to the same fake database, to plant data an old version could have written. */
async function openRaw() {
  const db = await openDB('telaviva-offline');
  return {
    put: (name: string, value: unknown, key?: string) => db.put(name, value, key),
    get: (name: string, key: string) => db.get(name, key),
  };
}

describe('snapshots', () => {
  it('round-trips and deletes a snapshot per uid', async () => {
    expect(await store.getSnapshot('a')).toBeNull();
    await store.putSnapshot('a', state(1, 2));
    const got = await store.getSnapshot('a');
    expect(got?.state.items).toHaveLength(2);
    expect(typeof got?.savedAt).toBe('string');
    expect(await store.getSnapshot('b')).toBeNull();
    await store.deleteSnapshot('a');
    expect(await store.getSnapshot('a')).toBeNull();
  });

  it('discards an invalid stored snapshot on read and deletes it', async () => {
    const raw = await openRaw();
    await raw.put('snapshots', { state: { version: 99, items: 'x' }, savedAt: NOW }, 'a');
    expect(await store.getSnapshot('a')).toBeNull();
    expect(await raw.get('snapshots', 'a')).toBeUndefined();
  });

  it('drops invalid rows of a stored snapshot, keeping the valid ones', async () => {
    const raw = await openRaw();
    const bad = { ...state(1), items: [item(1), { nope: true }] };
    await raw.put('snapshots', { state: bad, savedAt: NOW }, 'a');
    expect((await store.getSnapshot('a'))?.state.items).toHaveLength(1);
  });
});

describe('queue', () => {
  it('lists in insertion order, per uid', async () => {
    await store.enqueue(queued('z', 'a', 1));
    await store.enqueue(queued('b', 'a', 2));
    await store.enqueue(queued('m', 'other', 3));
    await store.enqueue(queued('a', 'a', 4));
    expect((await store.listQueue('a')).map((q) => q.id)).toEqual(['z', 'b', 'a']);
    expect(await store.countQueue('a')).toBe(3);
    expect(await store.countQueue('other')).toBe(1);
  });

  it('returns items without internal fields', async () => {
    await store.enqueue(queued('x', 'a'));
    expect((await store.listQueue('a'))[0]).toEqual(queued('x', 'a'));
  });

  it('updates in place keeping order, and does not resurrect a removed item', async () => {
    await store.enqueue(queued('x', 'a', 1));
    await store.enqueue(queued('y', 'a', 2));
    await store.updateQueued({ ...queued('x', 'a', 1), attempts: 3 });
    const list = await store.listQueue('a');
    expect(list.map((q) => [q.id, q.attempts])).toEqual([
      ['x', 3],
      ['y', 0],
    ]);
    await store.removeQueued('x');
    await store.updateQueued({ ...queued('x', 'a', 1), attempts: 4 });
    expect((await store.listQueue('a')).map((q) => q.id)).toEqual(['y']);
  });

  it('drops queued commands that fail validation on read', async () => {
    const raw = await openRaw();
    await store.enqueue(queued('ok', 'a', 1));
    await raw.put('queue', { ...queued('bad', 'a'), command: { type: 'nope' }, seq: 99 });
    expect((await store.listQueue('a')).map((q) => q.id)).toEqual(['ok']);
    expect(await raw.get('queue', 'bad')).toBeUndefined();
    expect(await store.countQueue('a')).toBe(1);
  });

  it('dropExpired removes only items older than 30 days and returns the count', async () => {
    const now = '2026-11-21T12:00:00.000Z';
    const at = (days: number) => new Date(Date.parse(now) - days * DAY).toISOString();
    await store.enqueue(queued('old', 'a', 1, at(31)));
    await store.enqueue(queued('edge', 'a', 2, at(30)));
    await store.enqueue(queued('new', 'a', 3, at(1)));
    await store.enqueue(queued('other-old', 'b', 4, at(40)));
    expect(await store.dropExpired('a', now)).toBe(1);
    expect((await store.listQueue('a')).map((q) => q.id)).toEqual(['edge', 'new']);
    expect(await store.countQueue('b')).toBe(1);
  });
});

describe('meta', () => {
  it('round-trips and deletes', async () => {
    expect(await store.getMeta('k')).toBeUndefined();
    await store.setMeta('k', { a: 1 });
    expect(await store.getMeta<{ a: number }>('k')).toEqual({ a: 1 });
    await store.deleteMeta('k');
    expect(await store.getMeta('k')).toBeUndefined();
  });
});

describe('wipeAccount', () => {
  it('removes everything of one uid and nothing else', async () => {
    for (const uid of ['a', 'b']) {
      await store.putSnapshot(uid, state(1));
      await store.enqueue(queued(`q-${uid}`, uid));
      await store.setMeta(`identity:${uid}`, 1);
      await store.setMeta(`progress:${uid}`, 1);
      await store.setMeta(`warm:${uid}`, 1);
    }
    await store.setMeta('last-identity', 'a');
    await store.setMeta('sign-out-pending', true);
    await store.wipeAccount('a');
    expect(await store.getSnapshot('a')).toBeNull();
    expect(await store.countQueue('a')).toBe(0);
    for (const k of ['identity:a', 'progress:a', 'warm:a'])
      expect(await store.getMeta(k)).toBeUndefined();
    expect(await store.getSnapshot('b')).not.toBeNull();
    expect(await store.countQueue('b')).toBe(1);
    for (const k of ['identity:b', 'progress:b', 'warm:b', 'last-identity', 'sign-out-pending']) {
      expect(await store.getMeta(k)).toBeDefined();
    }
  });
});

describe('openOfflineStore', () => {
  it('returns null without indexedDB, without throwing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await openOfflineStore()).toBeNull();
  });

  it('returns null when opening throws', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('SecurityError');
      },
    });
    expect(await openOfflineStore()).toBeNull();
  });

  it('returns null when opening never answers', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('indexedDB', { open: () => ({}) });
      const result = openOfflineStore();
      await vi.advanceTimersByTimeAsync(OPEN_TIMEOUT_MS + 1);
      expect(await result).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
