/**
 * What the tabs of one browser share about the offline queue: one lock, so only one tab sends at a time, and one
 * channel, so the others reload what changed.
 */

export const QUEUE_LOCK = 'telaviva-queue';
export const LIBRARY_CHANNEL = 'telaviva-library';

export type LockOutcome<T> = { ran: true; value: T } | { ran: false };

// Without Web Locks (Safari before 15.4), a lock inside this tab only. Two tabs may then send the same action twice;
// the server applies it once, since each carries its `commandId`.
let tail: Promise<void> = Promise.resolve();
let held = false;

async function withTabLock<T>(fn: () => Promise<T>, ifAvailable: boolean): Promise<LockOutcome<T>> {
  if (ifAvailable && held) return { ran: false };
  const before = tail;
  let release = () => {};
  tail = new Promise<void>((resolve) => (release = resolve));
  await before;
  held = true;
  try {
    return { ran: true, value: await fn() };
  } finally {
    held = false;
    release();
  }
}

/**
 * Runs `fn` holding the queue lock (`navigator.locks`, shared by every tab). `ifAvailable`: when another holder has
 * it, resolves `{ ran: false }` at once instead of waiting.
 */
export async function withQueueLock<T>(
  fn: () => Promise<T>,
  { ifAvailable = false }: { ifAvailable?: boolean } = {},
): Promise<LockOutcome<T>> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  if (!locks) return withTabLock(fn, ifAvailable);
  return locks.request(QUEUE_LOCK, { ifAvailable }, async (lock): Promise<LockOutcome<T>> =>
    lock ? { ran: true, value: await fn() } : { ran: false },
  );
}

/** `queue`: the account's queue changed. `synced`: queued actions reached the server. */
export type LibraryMessage = { uid: string; kind: 'queue' | 'synced' };

const hasChannel = () => typeof BroadcastChannel !== 'undefined';

/**
 * This tab's mark on what it sends. Every other BroadcastChannel object of the same name hears a message, this tab's
 * own listeners included, and those already know.
 */
const TAB = Math.random().toString(36).slice(2);

function isMessage(data: unknown): data is LibraryMessage & { from: string } {
  if (typeof data !== 'object' || data === null) return false;
  const { uid, kind, from } = data as Record<string, unknown>;
  return typeof uid === 'string' && typeof from === 'string' && (kind === 'queue' || kind === 'synced');
}

/**
 * Tells the other tabs (this one is not told). Without BroadcastChannel (Safari before 15.4) nothing is sent: the
 * other tabs catch up when they come back into view (the account library reloads on `visibilitychange`). The `storage`
 * event is not used as a fallback, so the uid is never written to localStorage.
 */
export function postLibraryMessage(message: LibraryMessage): void {
  if (!hasChannel()) return;
  const channel = new BroadcastChannel(LIBRARY_CHANNEL);
  try {
    channel.postMessage({ ...message, from: TAB });
  } finally {
    channel.close();
  }
}

/** Listens to the other tabs' messages about `uid`'s library; returns what stops listening. */
export function listenLibraryMessages(uid: string, onMessage: (message: LibraryMessage) => void): () => void {
  if (!hasChannel()) return () => {};
  const channel = new BroadcastChannel(LIBRARY_CHANNEL);
  channel.onmessage = (event: MessageEvent) => {
    const { data } = event;
    if (isMessage(data) && data.uid === uid && data.from !== TAB) onMessage({ uid: data.uid, kind: data.kind });
  };
  return () => channel.close();
}
