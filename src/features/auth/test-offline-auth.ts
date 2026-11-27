import { act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { reportOnline } from '@/features/library/test-library-server';
import type { LibraryState } from '@/features/library/types';
import type { OfflineStore } from '@/features/offline/store-types';
import { server } from '@/test/server';
import { rememberIdentity } from './offline-identity';
import { sessionUser, url } from './test-auth';
import { log } from './test-firebase';

/**
 * Helpers for the AuthProvider tests without a connection. They run with `fake-indexeddb/auto` and a fresh store
 * (`freshStore()` from test-library-server.ts) and log every failed request into `log` with a `:failed` suffix.
 */

/** The device kept `uid`'s identity and a copy of its list, as a signed-in visit online leaves them. */
export async function keptOnDevice(store: OfflineStore, uid: string, state: LibraryState) {
  await rememberIdentity(store, sessionUser(uid));
  await store.putSnapshot(uid, state);
}

let offline = false;

/** While offline, fails as a network error; once back online, falls through to the handlers installed before. */
const unreachable = (name: string) => () => {
  if (!offline) return undefined;
  log.push(`${name}:failed`);
  return HttpResponse.error();
};

/** No connection: the browser says so, and every account request fails as a network error. */
export function goOffline() {
  offline = true;
  reportOnline(false);
  server.use(
    http.get(url('/api/auth/me'), unreachable('GET me')),
    http.post(url('/api/auth/session'), unreachable('POST session')),
    http.delete(url('/api/auth/session'), unreachable('DELETE session')),
    http.get(url('/api/library'), unreachable('GET library')),
    http.post(url('/api/library/commands'), unreachable('POST command')),
    http.post(url('/api/library/merge'), unreachable('POST merge')),
  );
}

/** `/api/auth/me` reaches a server that answers `status` (a 5xx counts as "offline" for the start-up). */
export function meAnswers(status: number) {
  server.use(
    http.get(url('/api/auth/me'), () => {
      log.push(`GET me:${status}`);
      return HttpResponse.json({ error: 'unavailable' }, { status });
    }),
  );
}

/**
 * Back online: requests reach the handlers installed before `goOffline`, then the browser fires `online` (unless
 * `announce` is false: the connection is back, but the page has not heard of it yet).
 */
export function goOnline({ announce = true } = {}) {
  offline = false;
  reportOnline(true);
  if (announce) act(() => void window.dispatchEvent(new Event('online')));
}

/** Every account request answers 401: the session cookie is gone for good. */
export function sessionGone() {
  const gone = (name: string) => () => {
    log.push(`${name}:401`);
    return HttpResponse.json({ error: 'unauthenticated' }, { status: 401 });
  };
  server.use(
    http.get(url('/api/auth/me'), gone('GET me')),
    http.get(url('/api/library'), gone('GET library')),
    http.post(url('/api/library/commands'), gone('POST command')),
  );
}

/** Call before each test: the connection starts up. */
export function resetConnection() {
  offline = false;
}

export const wait = (ms: number) => act(async () => new Promise<void>((resolve) => setTimeout(resolve, ms)));
