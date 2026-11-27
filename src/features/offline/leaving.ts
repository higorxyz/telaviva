/**
 * Accounts signing out ("Sair" or a deleted account) in this browser. Background work that keeps device data for an
 * identity (series progress, warm-up times: device-meta.ts) must not write it again once the sign-out has started: the
 * wipe runs first, and a fetch landing after it (during the DELETE round trip, or in another tab still showing that
 * account) would bring the account's data back onto a shared device. The mark is shared with the other tabs over a
 * BroadcastChannel and lifted when the same account signs in again, so a later session writes as usual. It lives in
 * memory only: a page loaded after the sign-out is a visitor and has nothing of that account running.
 */
const CHANNEL = 'telaviva-leaving';

type Message = { uid: string; leaving: boolean };

const leaving = new Set<string>();
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function apply({ uid, leaving: isLeaving }: Message) {
  if (isLeaving === leaving.has(uid)) return;
  if (isLeaving) leaving.add(uid);
  else leaving.delete(uid);
  listeners.forEach((listener) => listener());
}

/** The channel to the other tabs, opened on first use; null where BroadcastChannel is missing (Safari < 15.4). */
function tabs(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL);
  // Node's channel (tests) would otherwise keep the process alive; browsers have no `unref`.
  (channel as BroadcastChannel & { unref?: () => void }).unref?.();
  channel.onmessage = (event: MessageEvent<Message>) => {
    const { uid, leaving: isLeaving } = event.data ?? {};
    if (typeof uid === 'string' && typeof isLeaving === 'boolean') apply({ uid, leaving: isLeaving });
  };
  return channel;
}

function announce(message: Message) {
  apply(message);
  try {
    tabs()?.postMessage(message);
  } catch {
    // Another tab simply keeps writing until it learns of the sign-out itself.
  }
}

/** `uid` is signing out: from now on nothing keeps device data for it, here or in the other tabs. */
export function markLeaving(uid: string): void {
  announce({ uid, leaving: true });
}

/** `uid` signed in (again): its device data may be kept again. Told to the other tabs even when this one had no mark. */
export function clearLeaving(uid: string): void {
  announce({ uid, leaving: false });
}

/** True while `identity` (a uid) is signing out. */
export function isLeaving(identity: string): boolean {
  tabs();
  return leaving.has(identity);
}

/** True for a meta key of an identity signing out (`<name>:<uid>`, the keys `wipeAccount` removes). */
export function isLeavingKey(key: string): boolean {
  tabs();
  for (const uid of leaving) if (key.endsWith(`:${uid}`)) return true;
  return false;
}

/** Calls `listener` whenever an identity starts or stops leaving; returns what stops listening. */
export function onLeavingChange(listener: () => void): () => void {
  tabs();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
