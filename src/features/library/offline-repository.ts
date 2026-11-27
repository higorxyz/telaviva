import { isLeaving } from '../offline/leaving';
import type { OfflineStore, QueuedCommand } from '../offline/store-types';
import { applyCommand, type LibraryCommand } from './commands';
import { NOTICE } from './copy';
import { createNoticeHub } from './notice-hub';
import { refOfCommand, titlePreImage } from './pre-image';
import { createQueueFlusher } from './queue-flusher';
import { listenLibraryMessages, postLibraryMessage, withQueueLock } from './queue-sync';
import {
  isNetworkError,
  LibraryRemoteError,
  type AppliedCommand,
  type LibraryQueue,
  type LibraryRepository,
  QUEUE_STALLED_AFTER,
} from './repository';
import type { ServerLibraryRepository } from './server-repository';
import { EMPTY_LIBRARY, type LibraryState } from './types';

type Options = {
  server: ServerLibraryRepository;
  store: OfflineStore;
  uid: string;
  now?: () => string;
};

/** The repository, with its queue always there. */
export type OfflineAccountRepository = LibraryRepository & { queue: LibraryQueue };

/** The queue applied over a copy, in order, each with its own time. One that no longer applies is skipped. */
function replay(state: LibraryState, queue: QueuedCommand[]): LibraryState {
  let next = state;
  for (const item of queue) {
    try {
      next = applyCommand(next, item.command, item.at);
    } catch {
      // The server refuses it too when it is sent, and the person is told then.
    }
  }
  return next;
}

const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** The store answers, or null: a store that fails (connection lost) never breaks the library. */
const quietly = <T>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

/**
 * The signed-in user's library, kept on the server, working without internet too. The last list the server sent is
 * saved on the device, per account; actions that cannot reach the server are applied to that copy at once and wait in
 * a queue (with the time they were done), which `queue.start()` sends in order when the connection returns.
 *
 * - `load`: the server's list (saved as the copy) with the queue on top; with no answer, the copy with the queue on
 *   top; with neither, the network error. Any answered error (401, 409, 5xx) passes through as before.
 * - `applyWithPreImage`: online with an empty queue, straight to the server (with a `commandId`). With actions
 *   waiting (to keep the order) or no answer, onto the queue: it answers the copy with the queue on top and no
 *   pre-image (`previous: null`); `queued` says how to undo it. A restore is never queued.
 *
 * When the store fails, each call falls back to the plain server behaviour. Once the account is signing out
 * (leaving.ts), an answer still in flight saves no copy and an action is no longer queued.
 */
export function createOfflineAccountRepository(options: Options): OfflineAccountRepository {
  const { server, store, uid, now = () => new Date().toISOString() } = options;
  const { notify, onNotice } = createNoticeHub();
  server.onNotice?.(notify);
  const queueListeners = new Set<() => void>();
  const changeListeners = new Set<() => void>();

  const queueChanged = () => queueListeners.forEach((listener) => listener());
  /** Sending only runs between `queue.start()` and its stop (while the library is mounted). */
  let started = false;
  const kick = () => {
    if (started) void flusher.flush();
  };

  const flusher = createQueueFlusher({
    store,
    server,
    uid,
    now,
    onProgress: queueChanged,
    onRetry: () => {
      queueChanged();
      // The other tabs' indicators read the same queue: let them show it is stuck too.
      postLibraryMessage({ uid, kind: 'queue' });
    },
    onSettled: ({ rejected, expired }) => {
      if (rejected > 0) notify('queueRejected');
      if (expired > 0) notify('queueExpired');
      queueChanged();
      changeListeners.forEach((listener) => listener());
    },
  });

  /** The device's view: the saved copy with the queue on top. Null without a copy. */
  async function local(): Promise<{ state: LibraryState; queue: QueuedCommand[] } | null> {
    const saved = await store.getSnapshot(uid);
    if (!saved) return null;
    const queue = await store.listQueue(uid);
    return { state: replay(saved.state, queue), queue };
  }

  async function send(command: LibraryCommand, commandId: string): Promise<AppliedCommand> {
    const applied = await server.applyWithPreImage(command, { commandId });
    // An answer landing after "Sair" wiped the account never writes it back (leaving.ts, as in device-meta.ts).
    // Checked right before the write, which starts in the same task: a wipe that begins later removes it.
    if (!isLeaving(uid)) await quietly(store.putSnapshot(uid, applied.state));
    // A success means the server answers: send whatever another tab may have queued.
    kick();
    return applied;
  }

  async function enqueue(command: LibraryCommand, id: string, at: string, failure: unknown): Promise<AppliedCommand> {
    if (isLeaving(uid)) throw failure;
    const view = await quietly(local());
    if (!view) throw failure;
    const state = applyCommand(view.state, command, at);
    // Signing out meanwhile: the action fails like no answer, and nothing of the account is queued.
    if (isLeaving(uid)) throw failure;
    if ((await quietly(store.enqueue({ id, uid, command, at, attempts: 0 }))) === null) throw failure;
    queueChanged();
    postLibraryMessage({ uid, kind: 'queue' });
    kick();
    return { state, previous: null, queued: { id, previous: titlePreImage(view.state, refOfCommand(command)) } };
  }

  async function applyWithPreImage(command: LibraryCommand): Promise<AppliedCommand> {
    const id = crypto.randomUUID();
    const at = now();
    if (command.type === 'restore') return send(command, id);
    const queue = await quietly(store.listQueue(uid));
    if (queue === null) return send(command, id);
    if (queue.length === 0 && !browserOffline()) {
      try {
        return await send(command, id);
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        // The same id: if the request reached the server after all, sending it again is a no-op.
        return enqueue(command, id, at, error);
      }
    }
    // Offline, or behind actions still waiting (to keep the order). Without a saved copy it fails like no answer.
    return enqueue(command, id, at, new LibraryRemoteError('No saved copy to apply the action to', { network: true }));
  }

  const queue: LibraryQueue = {
    count: async () => (await quietly(store.countQueue(uid))) ?? 0,
    async stalled() {
      const [head] = (await quietly(store.listQueue(uid))) ?? [];
      return (head?.attempts ?? 0) >= QUEUE_STALLED_AFTER;
    },
    subscribe(onChange) {
      queueListeners.add(onChange);
      const stop = listenLibraryMessages(uid, onChange);
      return () => {
        queueListeners.delete(onChange);
        stop();
      };
    },
    async unqueue(id) {
      // Waits for a send in progress (here or in another tab): the action is then either still queued or sent.
      const outcome = await withQueueLock(async () => {
        const items = await store.listQueue(uid);
        if (!items.some((item) => item.id === id)) return null;
        await store.removeQueued(id);
        const saved = await store.getSnapshot(uid);
        return replay(saved?.state ?? EMPTY_LIBRARY, items.filter((item) => item.id !== id));
      });
      const state = outcome.ran ? outcome.value : null;
      if (state) {
        queueChanged();
        postLibraryMessage({ uid, kind: 'queue' });
      }
      return state;
    },
    start() {
      started = true;
      const stop = flusher.start();
      return () => {
        started = false;
        stop();
      };
    },
  };

  return {
    persistent: true,
    remote: true,
    errorMessage: NOTICE.saveFailedAccount,
    queue,

    async load() {
      let state: LibraryState;
      try {
        state = await server.load();
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        const view = await quietly(local());
        if (!view) throw error;
        return view.state;
      }
      if (isLeaving(uid)) return state;
      await quietly(store.putSnapshot(uid, state));
      return replay(state, (await quietly(store.listQueue(uid))) ?? []);
    },

    async apply(command) {
      return (await applyWithPreImage(command)).state;
    },

    applyWithPreImage,

    subscribe(onChange) {
      const stopServer = server.subscribe(onChange);
      const stopTabs = listenLibraryMessages(uid, onChange);
      changeListeners.add(onChange);
      return () => {
        stopServer();
        stopTabs();
        changeListeners.delete(onChange);
      };
    },

    onNotice,
  };
}
