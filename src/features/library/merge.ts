import { normalizeLibraryState } from './schema';
import type { LibraryState } from './types';

/**
 * The visitor's library folded into the account's on the first sign-in (spec, "Visitante e logado"). Pure and
 * clock-free: the server clamps the guest's timestamps before calling it.
 *
 * - A title on both sides keeps the whole item with the newest `updatedAt` (status, snapshot and dates together).
 * - A rating on both sides keeps the one with the newest `updatedAt`.
 * - Episode marks are united; a mark on both sides keeps the newest `watchedAt`.
 * - On a tie the account's row stays, so merging the same guest again changes nothing.
 *
 * Nothing of the account is ever dropped: every key it has is in the result.
 */
export function mergeLibraries(account: LibraryState, guest: LibraryState): LibraryState {
  // Collapse duplicates inside each side first, so the tie rule below compares one row per key.
  const a = normalizeLibraryState(account);
  const g = normalizeLibraryState(guest);
  return normalizeLibraryState({
    version: 1,
    items: unite(a.items, g.items, (i) => `${i.mediaType}:${i.tmdbId}`, (i) => i.updatedAt),
    episodes: unite(a.episodes, g.episodes, (e) => `${e.tvId}:${e.seasonNumber}:${e.episodeNumber}`, (e) => e.watchedAt),
    ratings: unite(a.ratings, g.ratings, (r) => `${r.mediaType}:${r.tmdbId}`, (r) => r.updatedAt),
  });
}

/** Every key of both lists; a key on both sides takes the guest row only when it is strictly newer. */
function unite<T>(account: T[], guest: T[], keyOf: (row: T) => string, stampOf: (row: T) => string): T[] {
  const rows = new Map(account.map((row) => [keyOf(row), row]));
  for (const row of guest) {
    const key = keyOf(row);
    const current = rows.get(key);
    // Date.parse compares instants, whatever offset each side was written in.
    if (!current || Date.parse(stampOf(row)) > Date.parse(stampOf(current))) rows.set(key, row);
  }
  return [...rows.values()];
}
