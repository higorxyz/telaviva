import { describe, expect, it } from 'vitest';
import type { LibraryCommand } from './commands';
import { LibraryStorageError, createLocalRepository } from './local-repository';
import { backupsOf, item, KEY, memStorage, NOW, snap, want } from './test-storage';
import { EMPTY_LIBRARY } from './types';

describe('createLocalRepository: corrupt data and invalid writes', () => {
  it('backs up corrupted text, returns empty and keeps the backup', async () => {
    const { storage, data } = memStorage({ [KEY]: '{oops' });
    const repo = createLocalRepository({ storage, now: () => NOW });
    expect(await repo.load()).toEqual(EMPTY_LIBRARY);
    const backups = Object.keys(data).filter((k) => k.startsWith(`${KEY}:corrupt:`));
    expect(backups).toHaveLength(1);
    expect(data[backups[0]]).toBe('{oops');
    await repo.apply(want(1));
    expect(data[backups[0]]).toBe('{oops');
  });

  it('backs up the same unreadable text only once, however many times it is read', async () => {
    const { storage, data } = memStorage({ [KEY]: '{oops' });
    const repo = createLocalRepository({ storage, now: () => NOW });
    await repo.load();
    await repo.load();
    await repo.load();
    expect(backupsOf(data)).toHaveLength(1);
  });

  it('backs up schema-invalid JSON too', async () => {
    const raw = JSON.stringify({ version: 9 });
    const { storage, data } = memStorage({ [KEY]: raw });
    const repo = createLocalRepository({ storage, now: () => NOW });
    expect(await repo.load()).toEqual(EMPTY_LIBRARY);
    expect(Object.keys(data).some((k) => k.startsWith(`${KEY}:corrupt:`))).toBe(true);
  });

  it('drops only the invalid rows, backs the raw value up once and reports the recovery once', async () => {
    const raw = JSON.stringify({
      version: 1,
      items: [item(1), item(2, ''), { nonsense: true }, item(3)],
      episodes: [{ tvId: 9, seasonNumber: 1, episodeNumber: 1, watchedAt: NOW }, { tvId: 'x' }],
      ratings: [{ mediaType: 'movie', tmdbId: 1, score: 99, ratedAt: NOW, updatedAt: NOW }],
    });
    const { storage, data } = memStorage({ [KEY]: raw });
    const repo = createLocalRepository({ storage, now: () => NOW });
    const notices: string[] = [];
    repo.onNotice?.((notice) => notices.push(notice));

    const state = await repo.load();
    expect(state.items.map((i) => i.tmdbId)).toEqual([1, 3]);
    expect(state.episodes).toHaveLength(1);
    expect(state.ratings).toEqual([]);
    expect(backupsOf(data)).toHaveLength(1);
    expect(data[backupsOf(data)[0]]).toBe(raw);

    await repo.load();
    expect(backupsOf(data)).toHaveLength(1);
    expect(notices).toEqual(['recovered']);

    // The next write saves the clean state; the backup stays.
    await repo.apply(want(4));
    expect(JSON.parse(data[KEY]).items.map((i: { tmdbId: number }) => i.tmdbId)).toEqual([1, 3, 4]);
    expect(data[backupsOf(data)[0]]).toBe(raw);
  });

  it('holds the recovery notice until someone listens', async () => {
    const raw = JSON.stringify({ version: 1, items: [item(1), { bad: 1 }], episodes: [], ratings: [] });
    const { storage } = memStorage({ [KEY]: raw });
    const repo = createLocalRepository({ storage, now: () => NOW });
    await repo.load();
    const notices: string[] = [];
    repo.onNotice?.((notice) => notices.push(notice));
    expect(notices).toEqual(['recovered']);
  });

  it('a snapshot with an empty title cannot corrupt the library: the write is refused and nothing changes', async () => {
    const { storage, data } = memStorage();
    const repo = createLocalRepository({ storage, now: () => NOW });
    await repo.apply(want(1));
    const before = data[KEY];
    const bad: LibraryCommand = { type: 'setStatus', ref: { mediaType: 'movie', tmdbId: 2 }, status: 'want', snapshot: snap('') };
    await expect(repo.apply(bad)).rejects.toBeInstanceOf(LibraryStorageError);
    expect(data[KEY]).toBe(before);
    expect((await repo.load()).items.map((i) => i.tmdbId)).toEqual([1]);
    expect(backupsOf(data)).toHaveLength(0);
  });

  it('refuses an invalid state in memory mode too', async () => {
    const repo = createLocalRepository({ storage: null, now: () => NOW });
    await repo.apply(want(1));
    const bad: LibraryCommand = { type: 'setStatus', ref: { mediaType: 'movie', tmdbId: 2 }, status: 'want', snapshot: snap('') };
    await expect(repo.apply(bad)).rejects.toBeInstanceOf(LibraryStorageError);
    expect((await repo.load()).items).toHaveLength(1);
  });

  it('rejects and leaves the key untouched when the corrupt backup cannot be written', async () => {
    const { storage, data } = memStorage({ [KEY]: '{oops' });
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    const repo = createLocalRepository({ storage, now: () => NOW });
    expect(repo.persistent).toBe(true);
    await expect(repo.apply(want(1))).rejects.toBeInstanceOf(LibraryStorageError);
    expect(data[KEY]).toBe('{oops');
  });
});
