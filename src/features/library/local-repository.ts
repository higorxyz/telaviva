import { applyCommand, type LibraryCommand } from './commands';
import type { LibraryRepository } from './repository';
import { normalizeLibraryState, parseLibraryState } from './schema';
import { EMPTY_LIBRARY, type LibraryState } from './types';
import { importV1 } from './v1-import';

const KEY = 'telaviva:library:v1';
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

export function createLocalRepository(
  opts: { storage?: Storage | null; now?: () => string } = {},
): LibraryRepository {
  const now = opts.now ?? (() => new Date().toISOString());
  const storage = probe(() => (opts.storage !== undefined ? opts.storage : window.localStorage));
  let memory: LibraryState = EMPTY_LIBRARY;

  /** Reads the saved state. A broken value is copied to a backup key before starting empty. */
  function read(store: Storage): LibraryState {
    const raw = store.getItem(KEY);
    if (raw === null) return EMPTY_LIBRARY;
    let parsed: LibraryState | null = null;
    try {
      parsed = parseLibraryState(JSON.parse(raw));
    } catch {
      parsed = null;
    }
    if (parsed) return normalizeLibraryState(parsed);
    try {
      store.setItem(`${KEY}:corrupt:${Date.now()}`, raw);
    } catch (cause) {
      throw new LibraryStorageError('Could not back up the unreadable library', { cause });
    }
    return EMPTY_LIBRARY;
  }

  function write(store: Storage, state: LibraryState): void {
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
      return read(storage);
    },

    async apply(command: LibraryCommand) {
      const current = storage ? read(storage) : memory;
      const next = applyCommand(current, command, now());
      if (storage) write(storage, next);
      else memory = next;
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
  };
}
