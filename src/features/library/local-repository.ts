import { applyCommand, type LibraryCommand } from './commands';
import type { LibraryNotice, LibraryRepository } from './repository';
import { isValidLibraryState, normalizeLibraryState, parseLibraryEntries } from './schema';
import { EMPTY_LIBRARY, type LibraryState } from './types';
import { importV1 } from './v1-import';

const KEY = 'telaviva:library:v1';
const BACKUP_PREFIX = `${KEY}:corrupt:`;
const IMPORT_DONE_KEY = 'telaviva:library:v1-import-done';

export class LibraryStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'LibraryStorageError';
  }
}

/**
 * Returns the Storage when it can be read, or null when it is missing or blocked.
 * Only a read is probed: a full storage still holds the saved library, so writes
 * that fail later surface as LibraryStorageError instead of switching to memory.
 */
function probe(candidate: () => Storage | null): Storage | null {
  try {
    const storage = candidate();
    if (!storage) return null;
    storage.getItem(KEY);
    return storage;
  } catch {
    return null;
  }
}

function hasBackup(store: Storage, raw: string): boolean {
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key?.startsWith(BACKUP_PREFIX) && store.getItem(key) === raw) return true;
  }
  return false;
}

/** Copies `raw` to a backup key unless an identical backup exists. True when a new backup was written. */
function backUp(store: Storage, raw: string): boolean {
  if (hasBackup(store, raw)) return false;
  try {
    store.setItem(`${BACKUP_PREFIX}${Date.now()}`, raw);
    return true;
  } catch (cause) {
    throw new LibraryStorageError('Could not back up the unreadable library', { cause });
  }
}

/** Nothing invalid is ever saved: a bad state (an empty title, say) is refused instead of corrupting the library. */
function assertValid(state: LibraryState): void {
  if (!isValidLibraryState(state)) throw new LibraryStorageError('Refusing to save an invalid library');
}

export function createLocalRepository(
  opts: { storage?: Storage | null; now?: () => string } = {},
): LibraryRepository {
  const now = opts.now ?? (() => new Date().toISOString());
  const storage = probe(() => (opts.storage !== undefined ? opts.storage : window.localStorage));
  let memory: LibraryState = EMPTY_LIBRARY;
  const listeners = new Set<(notice: LibraryNotice) => void>();
  let pending: LibraryNotice | null = null;

  function notify(notice: LibraryNotice) {
    if (listeners.size === 0) pending = notice;
    else listeners.forEach((listener) => listener(notice));
  }

  /**
   * Reads the saved state. Unreadable JSON or a wrong root shape is backed up before starting empty; invalid rows
   * are dropped one by one, after backing up the raw value (once: an identical backup is not repeated). Writes
   * (`strict`) refuse to go on without that backup; a plain load still shows what it could read.
   */
  function read(store: Storage, strict: boolean): LibraryState {
    const raw = store.getItem(KEY);
    if (raw === null) return EMPTY_LIBRARY;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      json = undefined;
    }
    const parsed = parseLibraryEntries(json);
    try {
      if (!parsed) {
        backUp(store, raw);
        return EMPTY_LIBRARY;
      }
      if (parsed.dropped > 0 && backUp(store, raw)) notify('recovered');
    } catch (error) {
      if (strict) throw error;
    }
    return parsed ? normalizeLibraryState(parsed.state) : EMPTY_LIBRARY;
  }

  function write(store: Storage, state: LibraryState): void {
    assertValid(state);
    try {
      store.setItem(KEY, JSON.stringify(state));
    } catch (cause) {
      throw new LibraryStorageError('Could not save the library', { cause });
    }
  }

  function importFromV1(store: Storage): LibraryState {
    const items = importV1(store, now());
    const state: LibraryState = { ...EMPTY_LIBRARY, items };
    try {
      if (items.length > 0) write(store, state);
      store.setItem(IMPORT_DONE_KEY, '1');
    } catch {
      // Nothing was marked as done, so the import is tried again on the next load.
    }
    return state;
  }

  return {
    persistent: storage !== null,

    async load() {
      if (!storage) return memory;
      if (storage.getItem(KEY) === null && storage.getItem(IMPORT_DONE_KEY) === null) {
        return importFromV1(storage);
      }
      return read(storage, false);
    },

    async apply(command: LibraryCommand) {
      const current = storage ? read(storage, true) : memory;
      const next = applyCommand(current, command, now());
      if (storage) write(storage, next);
      else {
        assertValid(next);
        memory = next;
      }
      return next;
    },

    subscribe(onChange) {
      if (typeof window === 'undefined') return () => {};
      const handler = (event: StorageEvent) => {
        if (event.key === KEY) onChange();
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },

    onNotice(listener) {
      listeners.add(listener);
      if (pending) {
        const notice = pending;
        pending = null;
        listener(notice);
      }
      return () => listeners.delete(listener);
    },
  };
}
