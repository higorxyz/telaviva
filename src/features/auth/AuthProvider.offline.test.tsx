import 'fake-indexeddb/auto';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '@/features/library/commands';
import { fakeLibraryServer, freshStore, hangRequests, queuedCommand } from '@/features/library/test-library-server';
import { KEY, NOW, want } from '@/features/library/test-storage';
import { EMPTY_LIBRARY } from '@/features/library/types';
import type { OfflineStore } from '@/features/offline/store-types';
import { REQUEST_TIMEOUT_MS } from '@/lib/request-timeout';
import { resetFirebaseClient } from './firebase-client';
import { OFFLINE_RECHECK_MS } from './start-up';
import { LAST_IDENTITY } from './offline-identity';
import {
  accounts,
  auth as holder,
  clearCookies,
  EXPIRED,
  hasHint,
  installDefaultApi,
  MERGED,
  probe,
  renderAuth,
  setHint,
  signedInOnServer,
} from './test-auth';
import { authConfig, fakeAuth, fakeUser, log, resetFakeFirebase } from './test-firebase';
import { goOffline, goOnline, keptOnDevice, meAnswers, resetConnection, sessionGone, wait } from './test-offline-auth';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

const auth = () => holder.current!;
const one = applyCommand(EMPTY_LIBRARY, want(3), NOW);
const minted = () => log.filter((entry) => entry.startsWith('getIdToken') || entry.startsWith('POST session'));

let store: OfflineStore;
beforeEach(async () => {
  resetFakeFirebase();
  resetFirebaseClient();
  resetConnection();
  authConfig.enabled = true;
  installDefaultApi();
  store = await freshStore();
});
afterEach(() => {
  vi.useRealTimers();
  clearCookies();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AuthProvider: opening the app without a connection (Foco 5)', () => {
  it('remembers who signed in, and the next start offline stays signed in with the saved list', async () => {
    accounts.set('u1', one);
    signedInOnServer('u1');
    const visit = renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    await waitFor(async () => expect(await store.getMeta(LAST_IDENTITY)).toBe('u1'));
    await waitFor(async () => expect(await store.getSnapshot('u1')).not.toBeNull());
    visit.unmount();

    log.length = 0;
    goOffline();
    renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    expect(auth().user?.email).toBe('u1@exemplo.com');
    expect(screen.queryByText(EXPIRED)).toBeNull();
    expect(minted()).toEqual([]);
    expect(hasHint()).toBe(true);
  });

  it('a 5xx from /api/auth/me also counts as offline', async () => {
    await keptOnDevice(store, 'u1', one);
    setHint();
    meAnswers(503);
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    expect(screen.queryByText(EXPIRED)).toBeNull();
  });

  it('a 5xx (the connection never dropped, so no `online`): the timer asks again and a later 401 still expires', async () => {
    await keptOnDevice(store, 'u1', one);
    setHint();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    meAnswers(503);
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    sessionGone();
    expect(screen.queryByText(EXPIRED)).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(OFFLINE_RECHECK_MS));
    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
  });

  it('signal but no data: one timed-out /api/auth/me (not retried) signs in from the device, then the saved list', async () => {
    await keptOnDevice(store, 'u1', one);
    setHint();
    // The start-up's own short waits (the store, lazy modules) still run; only the 8 s are skipped.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    const fetch = hangRequests();
    const calls = (path: string) => fetch.mock.calls.filter(([input]) => String(input).endsWith(path)).length;
    renderAuth();
    await waitFor(() => expect(calls('/api/auth/me')).toBe(1));
    await act(() => vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS));
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    expect(calls('/api/auth/me')).toBe(1);
    // The library's GET hangs too: after its own timeout, the saved copy.
    await waitFor(() => expect(calls('/api/library')).toBe(1));
    await act(() => vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS));
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    expect(screen.queryByText(EXPIRED)).toBeNull();
  });

  it('without a kept identity it is a visitor, as before', async () => {
    setHint();
    goOffline();
    renderAuth();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(screen.queryByText(EXPIRED)).toBeNull();
    expect(minted()).toEqual([]);
  });

  it('a true 401 (not a network error) still follows the expired-session flow, kept identity or not', async () => {
    await keptOnDevice(store, 'u1', one);
    setHint();
    renderAuth();
    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    // The expired session was the last identity's: its saved copy goes too.
    await waitFor(async () => expect(await store.getSnapshot('u1')).toBeNull());
  });

  it('a true 401 once back online: expired toast, saved copy deleted, the queue kept for that account', async () => {
    await keptOnDevice(store, 'u1', one);
    await store.enqueue(queuedCommand(want(4), new Date().toISOString(), 'u1'));
    setHint();
    goOffline();
    renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|2'));

    sessionGone();
    goOnline();
    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(await store.getSnapshot('u1')).toBeNull();
    expect(await store.countQueue('u1')).toBe(1);
    expect(await store.getMeta(LAST_IDENTITY)).toBeUndefined();

    // Signing in again as that account sends what was kept.
    const library = fakeLibraryServer(one);
    signedInOnServer('u1');
    fakeAuth.currentUser = fakeUser('u1');
    await act(() => auth().signInWithEmail('u1@exemplo.com', 'segredo'));
    await waitFor(() => expect(library.received.map((r) => r.command)).toEqual([want(4)]));
    await waitFor(async () => expect(await store.countQueue('u1')).toBe(0));
    await waitFor(() => expect(probe()).toBe('signed-in|u1|2'));
  });
});

describe('AuthProvider: the first-login merge without a connection', () => {
  it('waits for `online`, keeping the visitor list intact until then', async () => {
    const guest = JSON.stringify(applyCommand(EMPTY_LIBRARY, want(5), NOW));
    window.localStorage.setItem(KEY, guest);
    await keptOnDevice(store, 'u1', EMPTY_LIBRARY);
    setHint();
    goOffline();
    renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|0'));
    await wait(100);
    expect(log.filter((entry) => entry.startsWith('POST merge'))).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBe(guest);

    signedInOnServer('u1');
    goOnline();
    expect(await screen.findByText(MERGED)).toBeInTheDocument();
    expect(log).toContain('POST merge');
    expect(window.localStorage.getItem(KEY)).toBeNull();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
  });
});
