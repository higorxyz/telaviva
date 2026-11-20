import { EMPTY_LIBRARY, type LibraryState } from '@/features/library/types';

type ListName = 'items' | 'episodes' | 'ratings';

const encoder = new TextEncoder();
const byteSize = (value: unknown) => encoder.encode(JSON.stringify(value)).length;
/** `{"library":{"version":1,"items":[],"episodes":[],"ratings":[]}}`: the body around the rows. */
const ENVELOPE_BYTES = byteSize({ library: EMPTY_LIBRARY });

const empty = (): LibraryState => ({ version: 1, items: [], episodes: [], ratings: [] });

/**
 * Splits a library into libraries of disjoint keys whose merge body (`{ library }`) stays within `maxBytes` of UTF-8
 * JSON. Each row is counted with a comma, so the estimate never falls short.
 */
export function chunkLibrary(state: LibraryState, maxBytes: number): LibraryState[] {
  const chunks: LibraryState[] = [];
  let current = empty();
  let size = ENVELOPE_BYTES;
  let rows = 0;

  function add<K extends ListName>(list: K, row: LibraryState[K][number]) {
    const rowBytes = byteSize(row) + 1;
    if (rows > 0 && size + rowBytes > maxBytes) {
      chunks.push(current);
      current = empty();
      size = ENVELOPE_BYTES;
      rows = 0;
    }
    (current[list] as LibraryState[K][number][]).push(row);
    size += rowBytes;
    rows += 1;
  }

  for (const row of state.items) add('items', row);
  for (const row of state.ratings) add('ratings', row);
  for (const row of state.episodes) add('episodes', row);
  if (rows > 0) chunks.push(current);
  return chunks;
}

function keysOf(state: LibraryState): Set<string> {
  return new Set([
    ...state.items.map((i) => `item:${i.mediaType}:${i.tmdbId}`),
    ...state.ratings.map((r) => `rating:${r.mediaType}:${r.tmdbId}`),
    ...state.episodes.map((e) => `mark:${e.tvId}:${e.seasonNumber}:${e.episodeNumber}`),
  ]);
}

/** True when every item, rating and episode mark of `guest` is in `answer` (whichever side's row won). */
export function holdsEveryKey(answer: LibraryState, guest: LibraryState): boolean {
  const held = keysOf(answer);
  for (const key of keysOf(guest)) if (!held.has(key)) return false;
  return true;
}
