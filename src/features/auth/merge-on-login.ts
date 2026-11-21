import { normalizeLibraryState, parseLibraryEntries } from '@/features/library/schema';
import { GUEST_LIBRARY_KEY } from '@/features/library/storage-key';
import type { LibraryState } from '@/features/library/types';
import { chunkLibrary, holdsEveryKey } from './merge-chunks';

const KEY = GUEST_LIBRARY_KEY;

/** Copy of the visitor's library taken before its first merge into `uid`. Never removed automatically. */
export const preMergeKey = (uid: string) => `${KEY}:pre-merge:${uid}`;

/**
 * Fingerprint of a local copy the account already confirmed but that could not be cleared (no room for the backup).
 * It stops the same copy from being sent, and announced, on every load.
 */
export const confirmedKey = (uid: string) => `${KEY}:merged:${uid}`;

/** Well under the route's 2 MB body limit. */
export const MERGE_CHUNK_BYTES = 1.5 * 1024 * 1024;
const BACKOFF_MS = [500, 1500];

/**
 * `empty`: nothing to merge. `merged`: the account confirmed every guest key (announce it). `unchanged`: this exact
 * copy was confirmed before and is kept only for lack of room (nothing sent). `kept`: it failed; the copy stays.
 * `wrong_account`: the session belongs to another account now (another tab switched): it stopped, the copy stays.
 */
export type MergeOutcome = 'empty' | 'merged' | 'unchanged' | 'kept' | 'wrong_account';

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

/** FNV-1a over the raw value, plus its length: enough to tell one stored copy from another. */
function fingerprint(raw: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) hash = Math.imul(hash ^ raw.charCodeAt(i), 0x01000193);
  return `${raw.length}:${(hash >>> 0).toString(16)}`;
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readConfirmed(storage: Storage, uid: string): string | null {
  for (const store of [storage, sessionStore()]) {
    try {
      const value = store?.getItem(confirmedKey(uid));
      if (value) return value;
    } catch {
      // Unreadable: try the next one.
    }
  }
  return null;
}

/** A full localStorage may still take this short value; the tab's sessionStorage is the fallback. */
function writeConfirmed(storage: Storage, uid: string, value: string): void {
  for (const store of [storage, sessionStore()]) {
    try {
      store?.setItem(confirmedKey(uid), value);
      return;
    } catch {
      // Full or blocked: try the next one.
    }
  }
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

async function isWrongAccount(response: Response): Promise<boolean> {
  if (response.status !== 409) return false;
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return body?.error === 'wrong_account';
}

/**
 * One merge request for `uid` (named in `X-Expected-User`, so the server never folds this copy into another account
 * that signed in from another tab). A network error is retried (3 tries in all); any answer but 200 gives up at once.
 */
async function send(
  uid: string,
  chunk: LibraryState,
  sleep: (ms: number) => Promise<void>,
): Promise<LibraryState | null | 'wrong_account'> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetch('/api/library/merge', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Expected-User': uid },
        body: JSON.stringify({ library: chunk }),
      });
    } catch {
      if (attempt >= BACKOFF_MS.length) return null;
      await sleep(BACKOFF_MS[attempt]);
      continue;
    }
    if (await isWrongAccount(response)) return 'wrong_account';
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
  if (readConfirmed(storage, uid) === fingerprint(raw)) return 'unchanged';

  const backedUp = backUp(storage, uid, raw);
  let answer: LibraryState | null = null;
  for (const chunk of chunkLibrary(guest, opts.chunkBytes ?? MERGE_CHUNK_BYTES)) {
    const sent = await send(uid, chunk, opts.sleep ?? wait);
    if (sent === 'wrong_account') return 'wrong_account';
    if (!sent) return 'kept';
    answer = sent;
  }
  if (!answer || !holdsEveryKey(answer, guest)) return 'kept';

  let cleared = false;
  if (backedUp) {
    try {
      if (storage.getItem(KEY) === raw) {
        storage.removeItem(KEY);
        cleared = true;
      }
    } catch {
      // The copy stays; merging it again changes nothing.
    }
  }
  if (!cleared) writeConfirmed(storage, uid, fingerprint(raw));
  return 'merged';
}
