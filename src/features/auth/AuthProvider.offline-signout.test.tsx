import 'fake-indexeddb/auto';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '@/features/library/commands';
import { freshStore, queuedCommand } from '@/features/library/test-library-server';
import { NOW, want } from '@/features/library/test-storage';
import { EMPTY_LIBRARY } from '@/features/library/types';
import type { OfflineStore } from '@/features/offline/store-types';
import { server } from '@/test/server';
import { resetFirebaseClient } from './firebase-client';
import { identityKey, LAST_IDENTITY, SIGN_OUT_PENDING } from './offline-identity';
import {
  accounts,
  auth as holder,
  clearCookies,
  hasHint,
  installDefaultApi,
  probe,
  renderAuth,
  setHint,
  signedInOnServer,
  url,
} from './test-auth';
import { authConfig, fakeAuth, fakeUser, log, resetFakeFirebase, sdk } from './test-firebase';
import { goOffline, goOnline, resetConnection, wait } from './test-offline-auth';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

const auth = () => holder.current!;
const one = applyCommand(EMPTY_LIBRARY, want(3), NOW);
const later = () => new Date().toISOString();
const isRequest = (entry: string) => /^(GET|POST|DELETE) /.test(entry);
const renewals = () => log.filter((e) => e.startsWith('GET me') || e.startsWith('getIdToken') || e.startsWith('POST session'));

let store: OfflineStore;
beforeEach(async () => {
  resetFakeFirebase();
  resetFirebaseClient();
  resetConnection();
  authConfig.enabled = true;
  installDefaultApi();
  // A queued action that ever reached the server would show here.
  server.use(
    http.post(url('/api/library/commands'), () => {
      log.push('POST command');
      return HttpResponse.json({ error: 'unavailable' }, { status: 503 });
    }),
  );
  store = await freshStore();
});
afterEach(() => {
  clearCookies();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Signed in as u1 online, its list saved on the device; then the connection drops and two actions wait. */
async function signedInThenOffline() {
  accounts.set('u1', one);
  signedInOnServer('u1');
  fakeAuth.currentUser = fakeUser('u1');
  const view = renderAuth();
  await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
  await waitFor(async () => expect(await store.getSnapshot('u1')).not.toBeNull());
  goOffline();
  await store.enqueue(queuedCommand(want(4), later(), 'u1'));
  await store.enqueue(queuedCommand(want(5), later(), 'u1'));
  return view;
}

async function expectNothingOf(uid: string) {
  expect(await store.getSnapshot(uid)).toBeNull();
  expect(await store.countQueue(uid)).toBe(0);
  expect(await store.getMeta(identityKey(uid))).toBeUndefined();
}

describe('AuthProvider: "Sair" without a connection (Foco 3)', () => {
  it('wipes the account from the device, signs Firebase out, marks the sign-out pending and is a visitor', async () => {
    await signedInThenOffline();
    await act(() => auth().signOut());
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    await expectNothingOf('u1');
    expect(await store.getMeta(LAST_IDENTITY)).toBeUndefined();
    expect(await store.getMeta(SIGN_OUT_PENDING)).toEqual({ uid: 'u1' });
    expect(log).toContain('DELETE session:failed');
    expect(log).toContain('signOut');
    expect(fakeAuth.currentUser).toBeNull();
    expect(hasHint()).toBe(false);
  });

  it('with the mark, a reload is a visitor even with the hint and never renews; online, the DELETE goes first', async () => {
    await store.setMeta(SIGN_OUT_PENDING, { uid: 'u1' });
    signedInOnServer('u1');
    // The Firebase SDK still holds A (it could not load to sign out offline).
    fakeAuth.currentUser = fakeUser('u1');
    goOffline();
    renderAuth();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    await wait(50);
    expect(log.find(isRequest)).toBe('DELETE session:failed');
    expect(renewals()).toEqual([]);
    expect(hasHint()).toBe(false);
    await waitFor(() => expect(fakeAuth.currentUser).toBeNull());
    expect(await store.getMeta(SIGN_OUT_PENDING)).toEqual({ uid: 'u1' });

    log.length = 0;
    setHint(); // Whatever the cookie says, the mark wins until the DELETE lands.
    goOnline();
    await waitFor(async () => expect(await store.getMeta(SIGN_OUT_PENDING)).toBeUndefined());
    expect(log.find(isRequest)).toBe('DELETE session');
    expect(renewals()).toEqual([]);
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
  });

  it('B signing in afterwards: A’s cookie is cleared first, and B never gets A’s list or queue', async () => {
    accounts.set('b', applyCommand(applyCommand(EMPTY_LIBRARY, want(7), NOW), want(8), NOW));
    await signedInThenOffline();
    await act(() => auth().signOut());
    expect(await store.getMeta(SIGN_OUT_PENDING)).toEqual({ uid: 'u1' });

    // The connection is back, but the page has not heard of it yet when B signs in.
    goOnline({ announce: false });
    sdk.signInWithEmailAndPassword.mockImplementation(async () => {
      fakeAuth.currentUser = fakeUser('b');
      return { user: fakeAuth.currentUser };
    });
    log.length = 0;
    await act(() => auth().signInWithEmail('b@exemplo.com', 'segredo'));
    await waitFor(() => expect(probe()).toBe('signed-in|b|2'));
    expect(log.find(isRequest)).toBe('DELETE session');
    expect(log.indexOf('DELETE session')).toBeLessThan(log.indexOf('POST session:token-b'));
    expect(await store.getMeta(SIGN_OUT_PENDING)).toBeUndefined();
    await expectNothingOf('u1');
    await waitFor(async () => expect(await store.getMeta(LAST_IDENTITY)).toBe('b'));
    await wait(50);
    expect(log).not.toContain('POST command');
    expect(await store.countQueue('b')).toBe(0);
  });

  it('a renewal while another tab left a sign-out pending never mints a session', async () => {
    accounts.set('u1', one);
    signedInOnServer('u1');
    fakeAuth.currentUser = fakeUser('u1');
    renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    await store.setMeta(SIGN_OUT_PENDING, { uid: 'u1' });
    log.length = 0;
    let renewed: boolean | undefined;
    await act(async () => {
      renewed = await auth().renewSession();
    });
    expect(renewed).toBe(false);
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(renewals()).toEqual([]);
  });
});

describe('AuthProvider: "Sair" and "Excluir" online', () => {
  it('"Sair" wipes the account from the device and leaves no mark', async () => {
    accounts.set('u1', one);
    signedInOnServer('u1');
    renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    await waitFor(async () => expect(await store.getSnapshot('u1')).not.toBeNull());
    await act(() => auth().signOut());
    expect(log).toContain('DELETE session');
    await expectNothingOf('u1');
    expect(await store.getMeta(SIGN_OUT_PENDING)).toBeUndefined();
  });

  it('a deleted account is wiped from the device (wipeAccount)', async () => {
    accounts.set('u1', one);
    signedInOnServer('u1');
    renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    await waitFor(async () => expect(await store.getSnapshot('u1')).not.toBeNull());
    await store.setMeta('progress:u1', { answer: 'kept' });
    await act(() => auth().accountDeleted('Conta excluída.'));
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    await expectNothingOf('u1');
    expect(await store.getMeta('progress:u1')).toBeUndefined();
    expect(await store.getMeta(LAST_IDENTITY)).toBeUndefined();
    expect(await store.getMeta(SIGN_OUT_PENDING)).toBeUndefined();
  });
});
