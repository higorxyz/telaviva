import type { LibraryCommand } from '../library/commands';
import type { LibraryState } from '../library/types';

/** One library action waiting to reach the server. `at` is when it was done on the device (ISO 8601). */
export type QueuedCommand = {
  id: string;
  uid: string;
  command: LibraryCommand;
  at: string;
  attempts: number;
};

export type StoredSnapshot = { state: LibraryState; savedAt: string };

/**
 * The on-device store (IndexedDB). Client-only. Reads never throw for bad stored data: an invalid snapshot reads as
 * absent and an invalid queued command is dropped, both deleted on the spot.
 */
export interface OfflineStore {
  getSnapshot(uid: string): Promise<StoredSnapshot | null>;
  putSnapshot(uid: string, state: LibraryState): Promise<void>;
  deleteSnapshot(uid: string): Promise<void>;

  /** Appends to the end of the queue. */
  enqueue(item: QueuedCommand): Promise<void>;
  /** The uid's queue in insertion order. */
  listQueue(uid: string): Promise<QueuedCommand[]>;
  removeQueued(id: string): Promise<void>;
  /** Replaces an item still in the queue, keeping its place; does nothing when it was removed meanwhile. */
  updateQueued(item: QueuedCommand): Promise<void>;
  countQueue(uid: string): Promise<number>;
  /** Removes items done more than 30 days before `now` (ISO) and returns how many. */
  dropExpired(uid: string, now: string): Promise<number>;

  getMeta<T = unknown>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  deleteMeta(key: string): Promise<void>;

  /**
   * Deletes that uid's snapshot, queue and every meta key ending in `:<uid>` (`identity:`, `progress:`, `warm:`…).
   * Other uids and the global keys (`last-identity`, `sign-out-pending`) are left to the caller.
   */
  wipeAccount(uid: string): Promise<void>;
}
