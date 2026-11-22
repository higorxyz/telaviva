import { withQueueLock } from '@/features/library/queue-sync';
import { openOfflineStore } from '@/features/offline/store';
import type { OfflineStore } from '@/features/offline/store-types';
import {
  clearSignOutPending,
  forgetIdentity,
  lastIdentityUid,
  markSignOutPending,
  offlineIdentity,
  readSignOutPending,
  rememberIdentity,
  wipeDeviceAccount,
} from './offline-identity';
import { deleteSession, type SessionUser } from './session-client';

/** `none`: no sign-out was pending. `settled`: its DELETE just reached the server. `pending`: it still did not. */
export type SignOutState = { state: 'none' } | { state: 'settled' | 'pending'; uid: string | null };

const NONE: SignOutState = { state: 'none' };

/** deleteSession never throws by contract; a test double (or a future change) that does counts as not reached. */
const reached = () => deleteSession().catch(() => false);

/**
 * The device side of the session, for the sign-in flows (one per AuthProvider): the identity kept for opening the app
 * offline, what "Sair" and an ended session remove from the device, and the pending sign-out. Every call degrades to
 * "nothing kept" when the offline store cannot open or fails (a lost connection reopens it on the next call).
 */
export function createDeviceSession(openStore: () => Promise<OfflineStore | null> = openOfflineStore) {
  let opening: Promise<OfflineStore | null> | null = null;
  /** A sign-out whose DELETE failed in this page, even when the store could not keep the mark. */
  let pendingHere: { uid: string | null } | null = null;
  let settling: Promise<SignOutState> | null = null;
  let watching = false;

  /** Runs store work one at a time, in call order: a late "remember" can never land after the wipe that followed it. */
  let tail: Promise<unknown> = Promise.resolve();
  function withStore<T>(work: (store: OfflineStore) => Promise<T>): Promise<T | null> {
    const run = tail.then(async () => {
      opening ??= openStore().catch(() => null);
      const store = await opening;
      if (!store) return null;
      try {
        return await work(store);
      } catch {
        opening = null;
        return null;
      }
    });
    tail = run;
    return run;
  }

  async function pendingSignOut(): Promise<{ uid: string | null } | null> {
    return (await withStore(readSignOutPending)) ?? pendingHere;
  }

  /** Tries the pending DELETE again as soon as the browser says the connection is back. */
  function retryWhenOnline() {
    if (watching || typeof window === 'undefined') return;
    watching = true;
    window.addEventListener(
      'online',
      () => {
        watching = false;
        void device.settleSignOut();
      },
      { once: true },
    );
  }

  const device = {
    /** Keeps `user` as the identity to open offline with, unless a sign-out is still pending (another tab). */
    remember: (user: SessionUser) =>
      withStore(async (store) => {
        if (pendingHere || (await readSignOutPending(store))) return;
        await rememberIdentity(store, user);
      }),

    identity: () => withStore(offlineIdentity),

    lastUid: () => withStore(lastIdentityUid),

    /**
     * "Sair" or the account deleted: everything of `uid` leaves the device now. Once any send still running (in any
     * tab) is done, it is wiped again, since that send may save its answer as the copy after this.
     */
    async wipe(uid: string) {
      await withStore((store) => wipeDeviceAccount(store, uid));
      void withQueueLock(() => withStore((store) => wipeDeviceAccount(store, uid))).catch(() => {});
    },

    /** A session that ended without "Sair" (a true 401, another account): the copy goes, the queue stays. */
    sessionEnded: (uid: string) =>
      withStore(async (store) => {
        await store.deleteSnapshot(uid);
        await forgetIdentity(store, uid);
      }),

    /** Another account signed in over `uid` (another tab switched): `uid`'s copy goes, its queue stays. */
    dropCopy: (uid: string) => withStore((store) => store.deleteSnapshot(uid)),

    async isSignOutPending(): Promise<boolean> {
      return (await pendingSignOut()) !== null;
    },

    /** The DELETE of a "Sair" failed: remember it until it reaches the server, and try again once online. */
    async markSignOutPending(uid: string | null) {
      pendingHere = { uid };
      await withStore((store) => markSignOutPending(store, uid));
      retryWhenOnline();
    },

    /** A session was just minted here (someone signed in): no older sign-out is pending any more. */
    async clearSignOutPending() {
      pendingHere = null;
      await withStore(clearSignOutPending);
    },

    /**
     * With a pending sign-out, sends its `DELETE /api/auth/session` (callers make it their first request) and drops
     * the mark only once the server answered. Concurrent calls share one try.
     */
    settleSignOut(): Promise<SignOutState> {
      settling ??= (async (): Promise<SignOutState> => {
        const mark = await pendingSignOut();
        if (!mark) return NONE;
        if (!(await reached())) {
          retryWhenOnline();
          return { state: 'pending', uid: mark.uid };
        }
        pendingHere = null;
        await withStore(clearSignOutPending);
        return { state: 'settled', uid: mark.uid };
      })().finally(() => {
        settling = null;
      });
      return settling;
    },
  };
  return device;
}

export type DeviceSession = ReturnType<typeof createDeviceSession>;
