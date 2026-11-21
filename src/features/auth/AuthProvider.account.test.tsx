import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { item, KEY } from '@/features/library/test-storage';
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

/** From now on the shared session cookie names `uid`: another tab signed in as them. */
function anotherTabSignsIn(uid: string) {
  server.use(http.get(url('/api/auth/me'), () => HttpResponse.json({ user: sessionUser(uid) })));
}

describe('AuthProvider: another tab switched accounts', () => {
  it('when the guest merge meets wrong_account, keeps the local copy and moves this tab to the account now in', async () => {
    const guest = JSON.stringify({ version: 1, items: [item(1)], episodes: [], ratings: [] });
    window.localStorage.setItem(KEY, guest);
    signedInOnServer('u1');
    let refused = false;
    server.use(
      http.post(url('/api/library/merge'), () => {
        if (refused) return HttpResponse.json({ version: 1, items: [], episodes: [], ratings: [] });
        refused = true;
        anotherTabSignsIn('u2');
        return HttpResponse.json({ error: 'wrong_account' }, { status: 409 });
      }),
    );
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u2/));
    expect(refused).toBe(true);
  });

  it('when the library meets wrong_account, moves this tab to the account now in and loads its list', async () => {
    signedInOnServer('u1');
    let refused = false;
    server.use(
      http.get(url('/api/library'), ({ request }) => {
        if (request.headers.get('x-expected-user') === 'u2') {
          return HttpResponse.json({ version: 1, items: [item(7)], episodes: [], ratings: [] });
        }
        refused = true;
        anotherTabSignsIn('u2');
        return HttpResponse.json({ error: 'wrong_account' }, { status: 409 });
      }),
    );
    renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u2|1'));
    expect(refused).toBe(true);
  });

  it('when a re-authentication is aborted after minting, looks again at who is in', async () => {
    signedInOnServer('u1');
    fakeAuth.currentUser = fakeUser('u1');
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    // The cookie minted for the re-authentication turns out to be someone else's (another tab won the race).
    server.use(
      http.post(url('/api/auth/session'), () => {
        log.push('POST session');
        anotherTabSignsIn('u2');
        return HttpResponse.json({ user: sessionUser('u2') });
      }),
    );

    let result: unknown;
    await act(async () => {
      result = await auth().reauthenticate();
    });
    expect(result).toBe('aborted');
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u2/));
  });
});
