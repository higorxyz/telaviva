import type { OfflineStore, QueuedCommand } from '../offline/store-types';
import { postLibraryMessage, withQueueLock } from './queue-sync';
import {
  LibraryConflictError,
  LibraryLimitError,
  LibraryRemoteError,
  LibrarySessionError,
  LibraryWrongAccountError,
} from './repository';
import type { ServerLibraryRepository } from './server-repository';
import type { LibraryState } from './types';

export const RETRY_BASE_MS = 2_000;
export const RETRY_MAX_MS = 5 * 60_000;

/** 2 s, 4 s, 8 s… up to 5 min, by how many attempts in a row failed before this one. */
export const retryDelay = (failures: number) => Math.min(RETRY_BASE_MS * 2 ** failures, RETRY_MAX_MS);

/** What one run did: actions sent, refused by the server (dropped, the person is told) and too old (dropped). */
export type FlushOutcome = { sent: number; rejected: number; expired: number };

type Options = {
  store: OfflineStore;
  server: ServerLibraryRepository;
  uid: string;
  /** A run sent or dropped something: the library and the queue changed. */
  onSettled: (outcome: FlushOutcome) => void;
  /** One action left the queue (sent or dropped), so a counter can follow along. */
  onProgress?: () => void;
  now?: () => string;
  /** Runs `retry` after `delay` ms and returns what cancels it (a timer, unless a test replaces it). */
  later?: (retry: () => void, delay: number) => () => void;
};

function timer(retry: () => void, delay: number): () => void {
  const id = setTimeout(retry, delay);
  return () => clearTimeout(id);
}

export interface QueueFlusher {
  /** Sends what is queued now, unless another tab is already sending. Never rejects. */
  flush(): Promise<void>;
  /** Sends now, then on `online` and when the tab comes back into view; returns `stop`. */
  start(): () => void;
  /** Removes the listeners and the scheduled retry (a run already going finishes). */
  stop(): void;
}

type Result =
  | { kind: 'sent'; state: LibraryState }
  | { kind: 'dropped'; tell: boolean }
  | { kind: 'retry' }
  | { kind: 'stop' };

const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Sends `uid`'s offline queue, in order, each action with the time it was done (`at`) and its id (`commandId`, so a
 * resend is a no-op), inside the queue lock: only one tab sends at a time. Errors:
 * - 400 (`stale` or validation) and 413 `limit`: drop that action, tell the person, go on;
 * - 409 `conflict`: only a restore gets it, and restores are never queued; dropped if it ever happens;
 * - 401: the server repository renews the session and resends once; if that fails, stop and keep the queue;
 * - 409 `wrong_account` and 403: stop and keep the queue (sign-in catches up; a 403 waits for the next trigger);
 * - anything else (no answer, 5xx, 404, 408, 429…): stop and try again later (2 s → 5 min).
 * At the end, the last answer becomes the saved copy, and when anything left the queue the other tabs are told.
 */
export function createQueueFlusher(options: Options): QueueFlusher {
  const { store, server, uid, onSettled, onProgress, now = () => new Date().toISOString(), later = timer } = options;
  let failures = 0;
  let cancelRetry = () => {};
  let running: Promise<void> | null = null;
  let again = false;
  let detach: (() => void) | null = null;

  function schedule(delay: number) {
    cancelRetry();
    cancelRetry = later(() => void flush(), delay);
  }

  async function send(item: QueuedCommand): Promise<Result> {
    try {
      const { state } = await server.applyWithPreImage(item.command, { at: item.at, commandId: item.id });
      return { kind: 'sent', state };
    } catch (error) {
      if (error instanceof LibrarySessionError || error instanceof LibraryWrongAccountError) return { kind: 'stop' };
      if (error instanceof LibraryConflictError) return { kind: 'dropped', tell: false };
      if (error instanceof LibraryLimitError) return { kind: 'dropped', tell: true };
      const status = error instanceof LibraryRemoteError ? error.status : null;
      // Only a 400 (`stale` or validation) is about the action itself: it would be refused again.
      if (status === 400) return { kind: 'dropped', tell: true };
      // Refused for this request, not this action (a firewall or bot challenge, say): keep it all for the next trigger.
      if (status === 403) return { kind: 'stop' };
      // Anything else (no answer, 5xx, 404 during a deploy, 408, 429…) may pass later.
      return { kind: 'retry' };
    }
  }

  async function run(): Promise<void> {
    const outcome: FlushOutcome = { sent: 0, rejected: 0, expired: await store.dropExpired(uid, now()) };
    let last: LibraryState | null = null;
    let changed = outcome.expired > 0;
    const seen = new Set<string>();
    try {
      for (;;) {
        // Read again each time: an undo or another tab may have changed the queue meanwhile.
        const [item] = await store.listQueue(uid);
        if (!item || seen.has(item.id)) break;
        seen.add(item.id);
        const result = await send(item);
        if (result.kind === 'stop') break;
        if (result.kind === 'retry') {
          await store.updateQueued({ ...item, attempts: item.attempts + 1 });
          schedule(retryDelay(failures++));
          break;
        }
        await store.removeQueued(item.id);
        changed = true;
        if (result.kind === 'sent') {
          last = result.state;
          outcome.sent += 1;
          failures = 0;
        } else if (result.tell) {
          outcome.rejected += 1;
        }
        onProgress?.();
      }
    } finally {
      if (last) await store.putSnapshot(uid, last).catch(() => {});
      // Also when the run only dropped actions: the other tabs' counts and lists must drop them too.
      if (changed) {
        postLibraryMessage({ uid, kind: last ? 'synced' : 'queue' });
        onSettled(outcome);
      }
    }
  }

  async function attempt() {
    // The browser knows it is offline: wait for `online` rather than fail and back off.
    if (browserOffline()) return;
    try {
      const { ran } = await withQueueLock(run, { ifAvailable: true });
      // Another tab is sending; look again shortly, in case it finished before seeing the latest action.
      if (!ran) schedule(RETRY_BASE_MS);
    } catch {
      // The store failed (the database connection was lost, say): try again later, never crash the page.
      schedule(retryDelay(failures++));
    }
  }

  function flush(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await attempt();
      } while (again);
    })().finally(() => {
      running = null;
    });
    return running;
  }

  function stop() {
    cancelRetry();
    detach?.();
    detach = null;
  }

  return {
    flush,
    stop,
    start() {
      stop();
      const onOnline = () => void flush();
      const onVisible = () => {
        if (document.visibilityState === 'visible') void flush();
      };
      window.addEventListener('online', onOnline);
      document.addEventListener('visibilitychange', onVisible);
      detach = () => {
        window.removeEventListener('online', onOnline);
        document.removeEventListener('visibilitychange', onVisible);
      };
      void flush();
      return stop;
    },
  };
}
