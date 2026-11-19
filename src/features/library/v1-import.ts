import type { LibraryItem } from './types';

function readList(storage: Storage, key: string): Record<string, unknown>[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null,
    );
  } catch {
    return [];
  }
}

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** Reads the v1 `watchedMovies` and `toWatchMovies` keys (never modified) as library items. */
export function importV1(storage: Storage, now: string): LibraryItem[] {
  const byId = new Map<number, LibraryItem>();
  const collect = (key: string, status: 'watched' | 'want') => {
    for (const entry of readList(storage, key)) {
      const id = entry.id;
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) continue;
      if (byId.has(id)) continue;
      const genreIds = Array.isArray(entry.genre_ids)
        ? entry.genre_ids.filter((g): g is number => typeof g === 'number' && Number.isInteger(g))
        : [];
      byId.set(id, {
        mediaType: 'movie',
        tmdbId: id,
        status,
        addedAt: now,
        updatedAt: now,
        watchedAt: status === 'watched' ? now : null,
        snapshot: {
          title: text(entry.title) ?? 'Sem título',
          posterPath: text(entry.poster_path),
          releaseDate: text(entry.release_date),
          genreIds,
        },
      });
    }
  };
  collect('watchedMovies', 'watched');
  collect('toWatchMovies', 'want');
  return [...byId.values()];
}
