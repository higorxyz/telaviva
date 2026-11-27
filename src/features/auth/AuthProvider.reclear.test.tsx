import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { resetFirebaseClient } from './firebase-client';
import { authConfig, fakeAuth, fakeUser, resetFakeFirebase } from './test-firebase';
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

/** The second clear, run by a mint that lands after a sign-out, fails (the first, from "Sair", works). */
const clears = vi.hoisted(() => ({ calls: 0 }));
vi.mock('./session-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./session-client')>();
  return {
    ...actual,
    deleteSession: async () => {
      clears.calls++;
      if (clears.calls > 1) throw new Error('the re-clear failed');
      return actual.deleteSession();
    },
  };
});

const auth = () => holder.current!;

beforeEach(() => {
  clears.calls = 0;
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

describe('AuthProvider: a re-clear that fails after a late mint', () => {
  it('still lets the re-authentication answer aborted instead of throwing', async () => {
    signedInOnServer('u1');
    fakeAuth.currentUser = fakeUser('u1');
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let sent = false;
    server.use(
      http.post(url('/api/auth/session'), async () => {
        sent = true;
        await gate;
        return HttpResponse.json({ user: sessionUser('u1') });
      }),
    );
    let outcome: Promise<unknown> = Promise.resolve();
    act(() => {
      outcome = auth().reauthenticate();
    });
    await waitFor(() => expect(sent).toBe(true));
    // "Sair" is bounded: let it time out on the stalled mint, clear the cookies, and become a visitor.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let leaving: Promise<void> = Promise.resolve();
    act(() => {
      leaving = auth().signOut();
    });
    await act(() => vi.advanceTimersByTimeAsync(5_100));
    vi.useRealTimers();
    await act(async () => leaving);
    expect(clears.calls).toBe(1);
    release();
    await act(async () => {
      await expect(outcome).resolves.toBe('aborted');
    });
    expect(clears.calls).toBe(2);
  });
});
