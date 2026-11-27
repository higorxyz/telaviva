import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { parseCommand } from '../library/command-schema';
import { normalizeLibraryState, parseLibraryEntries } from '../library/schema';
import type { LibraryState } from '../library/types';
import type { OfflineStore, QueuedCommand, StoredSnapshot } from './store-types';

const DB_NAME = 'telaviva-offline';
const DB_VERSION = 1;
const MAX_AGE_MS = 30 * 86_400_000;
/** A blocked or hung open resolves null instead of hanging the app. */
export const OPEN_TIMEOUT_MS = 4_000;

/**
 * Queue order: the key is the command `id` (a uuid), so each record also carries a `seq`, one more than the highest
 * in the store when it was enqueued, with a unique index. `listQueue` sorts by it. `seq` never leaves this module.
 */
type QueueRecord = QueuedCommand & { seq: number };

interface Schema extends DBSchema {
  snapshots: { key: string; value: StoredSnapshot };
  queue: { key: string; value: QueueRecord; indexes: { uid: string; seq: number } };
  meta: { key: string; value: unknown };
}
type Db = IDBPDatabase<Schema>;

function strip(record: QueueRecord): QueuedCommand {
  const { id, uid, command, at, attempts } = record;
  return { id, uid, command, at, attempts };
}

/** The queued command when its payload still passes the command schema, or null. */
function validQueued(record: QueueRecord): QueueRecord | null {
  const command = parseCommand(record.command);
  return command ? { ...record, command } : null;
}

function createStore(db: Db): OfflineStore {
  async function readQueue(uid: string): Promise<QueuedCommand[]> {
    const tx = db.transaction('queue', 'readwrite');
    const records = (await tx.store.index('uid').getAll(uid)).sort((a, b) => a.seq - b.seq);
    const kept: QueuedCommand[] = [];
    for (const record of records) {
      const ok = validQueued(record);
      if (ok) kept.push(strip(ok));
      else await tx.store.delete(record.id);
    }
    await tx.done;
    return kept;
  }

  return {
    async getSnapshot(uid) {
      const stored = await db.get('snapshots', uid);
      if (!stored) return null;
      const parsed = parseLibraryEntries(stored.state);
      if (!parsed || typeof stored.savedAt !== 'string') {
        await db.delete('snapshots', uid);
        return null;
      }
      return { state: normalizeLibraryState(parsed.state), savedAt: stored.savedAt };
    },
    async putSnapshot(uid: string, state: LibraryState) {
      await db.put('snapshots', { state, savedAt: new Date().toISOString() }, uid);
    },
    async deleteSnapshot(uid) {
      await db.delete('snapshots', uid);
    },

    async enqueue(item) {
      const tx = db.transaction('queue', 'readwrite');
      const last = await tx.store.index('seq').openCursor(null, 'prev');
      await tx.store.put({ ...item, seq: (last?.value.seq ?? 0) + 1 });
      await tx.done;
    },
    listQueue: readQueue,
    async removeQueued(id) {
      await db.delete('queue', id);
    },
    async updateQueued(item) {
      const tx = db.transaction('queue', 'readwrite');
      const existing = await tx.store.get(item.id);
      if (existing) await tx.store.put({ ...item, seq: existing.seq });
      await tx.done;
    },
    countQueue: async (uid) => (await readQueue(uid)).length,
    async dropExpired(uid, now) {
      const limit = Date.parse(now) - MAX_AGE_MS;
      const tx = db.transaction('queue', 'readwrite');
      let removed = 0;
      for (const record of await tx.store.index('uid').getAll(uid)) {
        if (Date.parse(record.at) < limit) {
          await tx.store.delete(record.id);
          removed += 1;
        }
      }
      await tx.done;
      return removed;
    },

    async getMeta<T>(key: string) {
      return (await db.get('meta', key)) as T | undefined;
    },
    async setMeta(key, value) {
      await db.put('meta', value, key);
    },
    async deleteMeta(key) {
      await db.delete('meta', key);
    },

    async wipeAccount(uid) {
      const tx = db.transaction(['snapshots', 'queue', 'meta'], 'readwrite');
      const suffix = `:${uid}`;
      const [queue, metaKeys] = await Promise.all([
        tx.objectStore('queue').index('uid').getAllKeys(uid),
        tx.objectStore('meta').getAllKeys(),
      ]);
      await Promise.all([
        tx.objectStore('snapshots').delete(uid),
        ...queue.map((id) => tx.objectStore('queue').delete(id)),
        ...metaKeys.filter((k) => k.endsWith(suffix)).map((k) => tx.objectStore('meta').delete(k)),
      ]);
      await tx.done;
    },
  };
}

async function open(): Promise<Db | null> {
  const opening = openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('snapshots');
      const queue = db.createObjectStore('queue', { keyPath: 'id' });
      queue.createIndex('uid', 'uid');
      queue.createIndex('seq', 'seq', { unique: true });
      db.createObjectStore('meta');
    },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), OPEN_TIMEOUT_MS);
  });
  try {
    const db = await Promise.race([opening, timeout]);
    // A late open must not leave a connection around.
    if (!db)
      opening.then(
        (late) => late.close(),
        () => {},
      );
    return db;
  } finally {
    clearTimeout(timer);
  }
}

/** The store, or null when IndexedDB is missing, blocked (Safari private mode) or does not answer. Never throws. */
export async function openOfflineStore(): Promise<OfflineStore | null> {
  try {
    if (typeof indexedDB === 'undefined') return null;
    const db = await open();
    return db ? createStore(db) : null;
  } catch {
    return null;
  }
}
