import { isLeavingKey } from './leaving';
import { openOfflineStore } from './store';
import type { OfflineStore } from './store-types';

/**
 * Best-effort access to the on-device store's `meta`, for data that only spares a request (series progress, warm-up
 * times): every failure reads as "nothing kept" and a write that fails is dropped. One connection is shared and opened
 * on first use; a failed or blocked open is tried again on the next call. It is also opened again when the IndexedDB
 * factory changes, which only tests do (each one installs a fresh fake database).
 */
let opened: { factory: IDBFactory | undefined; store: Promise<OfflineStore | null> } | null = null;

function currentFactory(): IDBFactory | undefined {
  return typeof indexedDB === 'undefined' ? undefined : indexedDB;
}

async function deviceStore(): Promise<OfflineStore | null> {
  const factory = currentFactory();
  if (!opened || opened.factory !== factory) opened = { factory, store: openOfflineStore() };
  const current = opened;
  const store = await current.store;
  if (!store && opened === current) opened = null;
  return store;
}

function forget() {
  opened = null;
}

export async function readDeviceMeta(key: string): Promise<unknown> {
  try {
    return await (await deviceStore())?.getMeta(key);
  } catch {
    forget();
    return undefined;
  }
}

/**
 * Writes `key` unless it belongs to an identity signing out (leaving.ts): checked again right before the write, so a
 * sign-out that starts while the store opens still wins, its wipe running after this write.
 */
export async function writeDeviceMeta(key: string, value: unknown): Promise<void> {
  if (isLeavingKey(key)) return;
  try {
    const store = await deviceStore();
    if (!store || isLeavingKey(key)) return;
    await store.setMeta(key, value);
  } catch {
    forget();
  }
}
