import 'fake-indexeddb/auto';
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '@/features/library/commands';
import { fakeLibraryServer, freshStore, queuedCommand } from '@/features/library/test-library-server';
import { KEY, NOW, want } from '@/features/library/test-storage';
import { EMPTY_LIBRARY } from '@/features/library/types';
import type { OfflineStore } from '@/features/offline/store-types';
import { resetFirebaseClient } from './firebase-client';
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
