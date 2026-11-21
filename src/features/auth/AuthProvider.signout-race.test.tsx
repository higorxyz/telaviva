import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { resetFirebaseClient } from './firebase-client';
import { authConfig, fakeAuth, fakeUser, log, resetFakeFirebase } from './test-firebase';
import {
  auth as holder,
  clearCookies,
  installDefaultApi,
  probe,
  renderAuth,
  sessionUser,
  signedInOnServer,
  url,
} from './test-auth';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

const auth = () => holder.current!;

beforeEach(() => {
  resetFakeFirebase();
  resetFirebaseClient();
  authConfig.enabled = true;
  installDefaultApi();
});
afterEach(() => {
  clearCookies();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

/** POST /api/auth/session waits for `release()`; its answer would set the session cookies again. */
function slowMint(user: Parameters<typeof sessionUser>[1] = {}) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.post(url('/api/auth/session'), async () => {
      log.push('POST session:sent');
      await gate;
      log.push('POST session:answered');
      return HttpResponse.json({ user: sessionUser('u1', user) });
    }),
  );
  return () => release();
}

/** The cookies end cleared: a DELETE reached the server after the late mint's answer. */
function expectClearedLast() {
  const answered = log.lastIndexOf('POST session:answered');
  expect(answered).toBeGreaterThanOrEqual(0);
  expect(log.lastIndexOf('DELETE session')).toBeGreaterThan(answered);
}

async function signedIn(firebaseVerified = false) {
  signedInOnServer('u1', { emailVerified: false });
  fakeAuth.currentUser = fakeUser('u1', { emailVerified: firebaseVerified });
  renderAuth();
  await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
}

describe('AuthProvider: "Sair" while a session is being minted', () => {
  it('the verified re-mint cannot bring the cleared cookie back', async () => {
    await signedIn(true);
    const release = slowMint({ emailVerified: true });
    let refreshing: Promise<void> = Promise.resolve();
    act(() => {
      refreshing = auth().refresh();
    });
    await waitFor(() => expect(log).toContain('POST session:sent'));
    let leaving: Promise<void> = Promise.resolve();
    act(() => {
      leaving = auth().signOut();
    });
    // Give an eager DELETE time to go out first: the late answer then lands after it.
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    release();
    await act(async () => {
      await Promise.all([refreshing, leaving]);
    });
    expectClearedLast();
    expect(probe()).toMatch(/^guest/);
  });

  it('a silent renewal cannot bring it back either', async () => {
    await signedIn();
    const release = slowMint();
    let renewing: Promise<boolean> = Promise.resolve(false);
    act(() => {
      renewing = auth().renewSession();
    });
    await waitFor(() => expect(log).toContain('POST session:sent'));
    let leaving: Promise<void> = Promise.resolve();
    act(() => {
      leaving = auth().signOut();
    });
    // Give an eager DELETE time to go out first: the late answer then lands after it.
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    release();
    await act(async () => {
      await Promise.all([renewing, leaving]);
    });
    expectClearedLast();
    expect(probe()).toMatch(/^guest/);
  });

  it('nor a re-authentication before deleting the account', async () => {
    await signedIn();
    const release = slowMint();
    let reauth: Promise<unknown> = Promise.resolve();
    act(() => {
      reauth = auth().reauthenticate();
    });
    await waitFor(() => expect(log).toContain('POST session:sent'));
    let leaving: Promise<void> = Promise.resolve();
    act(() => {
      leaving = auth().signOut();
    });
    // Give an eager DELETE time to go out first: the late answer then lands after it.
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    release();
    let outcome: unknown;
    await act(async () => {
      [outcome] = await Promise.all([reauth, leaving]);
    });
    expect(outcome).toBe('aborted');
    expectClearedLast();
    expect(probe()).toMatch(/^guest/);
  });
});
