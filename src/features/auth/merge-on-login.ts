import { normalizeLibraryState, parseLibraryEntries } from '@/features/library/schema';
import type { LibraryState } from '@/features/library/types';
import { chunkLibrary, holdsEveryKey } from './merge-chunks';

const KEY = 'telaviva:library:v1';

/** Copy of the visitor's library taken before its first merge into `uid`. Never removed automatically. */
export const preMergeKey = (uid: string) => `${KEY}:pre-merge:${uid}`;

/** Well under the route's 2 MB body limit. */
export const MERGE_CHUNK_BYTES = 1.5 * 1024 * 1024;
const BACKOFF_MS = [500, 1500];

/** `empty`: nothing to merge. `merged`: the account confirmed every guest key. `kept`: the local copy stays. */
export type MergeOutcome = 'empty' | 'merged' | 'kept';

type Options = {
  storage?: Storage | null;
  sleep?: (ms: number) => Promise<void>;
  chunkBytes?: number;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readGuest(raw: string): LibraryState | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = parseLibraryEntries(json);
  return parsed ? normalizeLibraryState(parsed.state) : null;
}

/** True when the backup exists afterwards (written now or by an earlier attempt). */
function backUp(storage: Storage, uid: string, raw: string): boolean {
  try {
    if (storage.getItem(preMergeKey(uid)) !== null) return true;
    storage.setItem(preMergeKey(uid), raw);
    return true;
  } catch {
    return false;
  }
}

/** One merge request. A network error is retried (3 tries in all); any answer but 200 gives up at once. */
async function send(chunk: LibraryState, sleep: (ms: number) => Promise<void>): Promise<LibraryState | null> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch('/api/library/merge', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ library: chunk }),
      });
    } catch {
      if (attempt >= BACKOFF_MS.length) return null;
      await sleep(BACKOFF_MS[attempt]);
      continue;
    }
    if (!response.ok) return null;
    const parsed = parseLibraryEntries(await response.json().catch(() => null));
    return parsed ? normalizeLibraryState(parsed.state) : null;
  }
}

/**
 * Folds the visitor's library into the signed-in account (plan, Foco 2):
 *
 * - the raw local value is backed up under `preMergeKey(uid)` once, before the first request;
 * - the library goes in chunks of disjoint keys (each under ~1.5 MB), and the local copy stays whole until all of
 *   them answered 200 and the last answer, the whole account, holds every guest key;
 * - only then is `telaviva:library:v1` removed, and only if the backup exists and no other tab changed it meanwhile.
 *
 * On any failure everything stays local and the next start tries again. Repeating is safe: the merge is idempotent.
 */
export async function mergeOnLogin(uid: string, opts: Options = {}): Promise<MergeOutcome> {
  const storage = opts.storage !== undefined ? opts.storage : browserStorage();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(KEY) ?? null;
  } catch {
    // Blocked storage holds no library to merge.
  }
  if (!storage || raw === null) return 'empty';
  const guest = readGuest(raw);
  if (!guest || guest.items.length + guest.ratings.length + guest.episodes.length === 0) return 'empty';

  const backedUp = backUp(storage, uid, raw);
  let answer: LibraryState | null = null;
  for (const chunk of chunkLibrary(guest, opts.chunkBytes ?? MERGE_CHUNK_BYTES)) {
    answer = await send(chunk, opts.sleep ?? wait);
    if (!answer) return 'kept';
  }
  if (!answer || !holdsEveryKey(answer, guest)) return 'kept';

  if (backedUp) {
    try {
      if (storage.getItem(KEY) === raw) storage.removeItem(KEY);
    } catch {
      // The copy stays; merging it again changes nothing.
    }
  }
  return 'merged';
}
