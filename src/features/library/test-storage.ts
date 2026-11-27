import type { LibraryCommand } from './commands';

export const KEY = 'telaviva:library:v1';
export const DONE = 'telaviva:library:v1-import-done';
export const NOW = '2026-11-19T12:00:00.000Z';
export const snap = (title: string) => ({ title, posterPath: null, releaseDate: null, genreIds: [] });
export const want = (id: number): LibraryCommand => ({
  type: 'setStatus',
  ref: { mediaType: 'movie', tmdbId: id },
  status: 'want',
  snapshot: snap(`T${id}`),
});

/** A Storage over a plain object, so tests can read and break what the repository saved. */
export function memStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial };
  const storage = {
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    clear: () => {},
    key: (i: number) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length;
    },
  } as Storage;
  return { storage, data };
}

export const backupsOf = (data: Record<string, string>) =>
  Object.keys(data).filter((k) => k.startsWith(`${KEY}:corrupt:`));

/** A raw stored item (a want movie), for hand-built stored values. */
export const item = (tmdbId: number, title = `T${tmdbId}`) => ({
  mediaType: 'movie',
  tmdbId,
  status: 'want',
  addedAt: NOW,
  updatedAt: NOW,
  watchedAt: null,
  snapshot: snap(title),
});
