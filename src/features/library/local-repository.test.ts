import { describe, expect, it, vi } from 'vitest';
import { LibraryStorageError, createLocalRepository } from './local-repository';
import { DONE, KEY, memStorage, NOW, snap, want } from './test-storage';
import { EMPTY_LIBRARY } from './types';

describe('createLocalRepository', () => {
  it('loads empty and persists applied commands', async () => {
    const { storage, data } = memStorage();
    const repo = createLocalRepository({ storage, now: () => NOW });
    expect(repo.persistent).toBe(true);
    expect(await repo.load()).toEqual(EMPTY_LIBRARY);
    const next = await repo.apply(want(1));
    expect(next.items).toHaveLength(1);
    expect(JSON.parse(data[KEY])).toEqual(next);
  });

  it('re-reads storage before applying (two repositories, same storage)', async () => {
    const { storage } = memStorage();
    const a = createLocalRepository({ storage, now: () => NOW });
    const b = createLocalRepository({ storage, now: () => NOW });
    await a.apply(want(1));
    const final = await b.apply(want(2));
    expect(final.items.map((i) => i.tmdbId).sort()).toEqual([1, 2]);
    expect((await a.load()).items).toHaveLength(2);
  });

  it('rejects with LibraryStorageError when storage is full and keeps saved state', async () => {
    const { storage, data } = memStorage();
    const repo = createLocalRepository({ storage, now: () => NOW });
    await repo.apply(want(1));
    const before = data[KEY];
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    await expect(repo.apply(want(2))).rejects.toBeInstanceOf(LibraryStorageError);
    expect(data[KEY]).toBe(before);
  });

  it('keeps a full storage persistent: load reads it and apply rejects', async () => {
    const { storage, data } = memStorage();
    await createLocalRepository({ storage, now: () => NOW }).apply(want(1));
    const before = data[KEY];
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    const repo = createLocalRepository({ storage, now: () => NOW });
    expect(repo.persistent).toBe(true);
    expect((await repo.load()).items).toHaveLength(1);
    await expect(repo.apply(want(2))).rejects.toBeInstanceOf(LibraryStorageError);
    expect(data[KEY]).toBe(before);
  });

  it('falls back to memory when storage access throws', async () => {
    const blocked = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const repo = createLocalRepository({ storage: blocked, now: () => NOW });
    expect(repo.persistent).toBe(false);
    expect(await repo.load()).toEqual(EMPTY_LIBRARY);
    await repo.apply(want(1));
    expect((await repo.load()).items).toHaveLength(1);
  });

  it('uses memory when storage is null', async () => {
    const repo = createLocalRepository({ storage: null, now: () => NOW });
    expect(repo.persistent).toBe(false);
    await repo.apply(want(3));
    expect((await repo.load()).items[0].tmdbId).toBe(3);
  });

  it('propagates domain errors unchanged', async () => {
    const { storage } = memStorage();
    const repo = createLocalRepository({ storage, now: () => NOW });
    const err = await repo
      .apply({
        type: 'setStatus',
        ref: { mediaType: 'movie', tmdbId: 1 },
        status: 'watching',
        snapshot: snap('x'),
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(LibraryStorageError);
  });

  it('dedupes a duplicated stored state on load', async () => {
    const item = (updatedAt: string, status: string) => ({
      mediaType: 'movie',
      tmdbId: 1,
      status,
      addedAt: NOW,
      updatedAt,
      watchedAt: status === 'watched' ? updatedAt : null,
      snapshot: snap('A'),
    });
    const { storage, data } = memStorage({
      [KEY]: JSON.stringify({
        version: 1,
        items: [item(NOW, 'want'), item('2026-11-21T00:00:00.000Z', 'watched')],
        episodes: [],
        ratings: [],
      }),
    });
    const repo = createLocalRepository({ storage, now: () => NOW });
    const state = await repo.load();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].status).toBe('watched');
    expect(Object.keys(data).some((k) => k.includes('corrupt'))).toBe(false);
  });

  it('notifies on storage events for the library key only', () => {
    const { storage } = memStorage();
    const repo = createLocalRepository({ storage, now: () => NOW });
    const cb = vi.fn();
    const off = repo.subscribe(cb);
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
    expect(cb).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  describe('v1 import', () => {
    const v1 = { watchedMovies: JSON.stringify([{ id: 550, title: 'Clube da Luta' }]) };

    it('imports once, sets the flag and keeps old keys', async () => {
      const { storage, data } = memStorage(v1);
      const repo = createLocalRepository({ storage, now: () => NOW });
      const first = await repo.load();
      expect(first.items).toHaveLength(1);
      expect(data[DONE]).toBeDefined();
      expect(data.watchedMovies).toBe(v1.watchedMovies);
      delete data[KEY];
      const second = await repo.load();
      expect(second.items).toHaveLength(0);
    });

    it('writes the flag even with nothing to import', async () => {
      const { storage, data } = memStorage();
      await createLocalRepository({ storage, now: () => NOW }).load();
      expect(data[DONE]).toBeDefined();
    });
  });
});
