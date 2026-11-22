import type { OfflineStore } from '@/features/offline/store-types';
import { sessionUserSchema, type SessionUser } from './session-client';

/**
 * Who was signed in on this device, kept in the offline store's `meta` (spec §6.3, "Identidade offline"), so the app
 * opened without a connection still shows that person's account instead of falling back to the visitor:
 *
 * - `identity:<uid>`: the `SessionUser` as the server last confirmed it. Its `:<uid>` suffix means `wipeAccount(uid)`
 *   removes it with the rest of the account.
 * - `last-identity`: only the uid of whoever signed in last, a pointer. The person's details live under one key only,
 *   and a pointer left behind by a wipe leads nowhere (`offlineIdentity` answers null).
 * - `sign-out-pending`: `{ uid }`, a "Sair" whose `DELETE /api/auth/session` never reached the server, so the
 *   httpOnly session cookie may still be there. While it exists the app is a visitor and never renews a session.
 *
 * These functions throw when the store does (the connection was lost): callers catch and degrade.
 */

export const LAST_IDENTITY = 'last-identity';
export const SIGN_OUT_PENDING = 'sign-out-pending';
export const identityKey = (uid: string) => `identity:${uid}`;

/** Called on every sign-in (`signedIn`/`adopt`): this user is the one to show when the app opens offline. */
export async function rememberIdentity(store: OfflineStore, user: SessionUser): Promise<void> {
  await store.setMeta(identityKey(user.id), user);
  await store.setMeta(LAST_IDENTITY, user.id);
}

/** The last signed-in user, when `last-identity` points at an `identity:<uid>` that still exists and is valid. */
export async function offlineIdentity(store: OfflineStore): Promise<SessionUser | null> {
  const uid = await store.getMeta(LAST_IDENTITY);
  if (typeof uid !== 'string' || uid === '') return null;
  const parsed = sessionUserSchema.safeParse(await store.getMeta(identityKey(uid)));
  return parsed.success && parsed.data.id === uid ? parsed.data : null;
}

/** The uid `last-identity` points at, if any. */
export async function lastIdentityUid(store: OfflineStore): Promise<string | null> {
  const uid = await store.getMeta(LAST_IDENTITY);
  return typeof uid === 'string' && uid !== '' ? uid : null;
}

/** Drops `last-identity` when it points at `uid`. */
async function dropPointer(store: OfflineStore, uid: string): Promise<void> {
  if ((await store.getMeta(LAST_IDENTITY)) === uid) await store.deleteMeta(LAST_IDENTITY);
}

/** Forgets `uid` as an identity to open offline with; its saved list and queue stay. */
export async function forgetIdentity(store: OfflineStore, uid: string): Promise<void> {
  await store.deleteMeta(identityKey(uid));
  await dropPointer(store, uid);
}

/** Everything of `uid` on this device ("Sair", account deleted), `last-identity` included; nobody else's. */
export async function wipeDeviceAccount(store: OfflineStore, uid: string): Promise<void> {
  await store.wipeAccount(uid);
  await dropPointer(store, uid);
}

export type PendingSignOut = { uid: string | null };

export async function markSignOutPending(store: OfflineStore, uid: string | null): Promise<void> {
  await store.setMeta(SIGN_OUT_PENDING, { uid });
}

/** The pending sign-out, or null. Any value there counts (failing closed): a malformed one names nobody. */
export async function readSignOutPending(store: OfflineStore): Promise<PendingSignOut | null> {
  const value = await store.getMeta(SIGN_OUT_PENDING);
  if (value === undefined) return null;
  const uid = (value as { uid?: unknown } | null)?.uid;
  return { uid: typeof uid === 'string' ? uid : null };
}

export async function clearSignOutPending(store: OfflineStore): Promise<void> {
  await store.deleteMeta(SIGN_OUT_PENDING);
}
