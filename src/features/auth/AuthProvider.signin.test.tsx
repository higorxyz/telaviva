import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { item, KEY } from '@/features/library/test-storage';
import { server } from '@/test/server';
import { loadFirebase, resetFirebaseClient } from './firebase-client';
import { preMergeKey } from './merge-on-login';
import { REDIRECT_FLAG } from './sign-in';
import { authConfig, authError, fakeUser, log, resetFakeFirebase, sdk } from './test-firebase';
import {
  auth as holder,
  clearCookies,
  hasHint,
  installDefaultApi,
  MERGED,
  probe,
  renderAuth,
  signedInOnServer,
  url,
} from './test-auth';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

const auth = () => holder.current!;
const guestRaw = JSON.stringify({ version: 1, items: [item(1), item(2)], episodes: [], ratings: [] });

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

async function asGuest() {
  const view = renderAuth();
  await waitFor(() => expect(probe()).toMatch(/^guest/));
  return view;
}

describe('AuthProvider: signing in', () => {
  it('posts the session, switches to the account, then merges the guest list and says so', async () => {
    window.localStorage.setItem(KEY, guestRaw);
    await asGuest();
    await act(async () => auth().signInWithEmail('u1@exemplo.com', 'segredo123'));
    expect(log.indexOf('POST session:token-u1')).toBeLessThan(log.indexOf('POST merge'));
    expect(await screen.findByText(MERGED)).toBeInTheDocument();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|2'));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(preMergeKey('u1'))).toBe(guestRaw);
  });

  it('does not merge an empty guest list', async () => {
    await asGuest();
    await act(async () => auth().signInWithEmail('u1@exemplo.com', 'segredo123'));
    await waitFor(() => expect(probe()).toBe('signed-in|u1|0'));
    expect(log).not.toContain('POST merge');
    expect(screen.queryByText(MERGED)).toBeNull();
  });

  it('keeps the guest list after a failed merge and retries it on the next start', async () => {
    window.localStorage.setItem(KEY, guestRaw);
    server.use(http.post(url('/api/library/merge'), () => new HttpResponse(null, { status: 500 })));
    const first = await asGuest();
    await act(async () => auth().signInWithEmail('u1@exemplo.com', 'segredo123'));
    await waitFor(() => expect(probe()).toBe('signed-in|u1|0'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(window.localStorage.getItem(KEY)).toBe(guestRaw);
    expect(screen.queryByText(MERGED)).toBeNull();
    first.unmount();

    installDefaultApi();
    signedInOnServer('u1');
    renderAuth();
    expect(await screen.findByText(MERGED)).toBeInTheDocument();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('signs up: name and fresh token before the session, verification e-mail after', async () => {
    await asGuest();
    await act(async () => auth().signUpWithEmail('Ana', 'ana@exemplo.com', 'segredo123'));
    expect(log.slice(0, 3)).toEqual(['createUser', 'updateProfile:Ana', 'getIdToken:true']);
    expect(log.indexOf('getIdToken:true')).toBeLessThan(log.indexOf('POST session:token-u1'));
    expect(log.indexOf('POST session:token-u1')).toBeLessThan(log.indexOf('sendEmailVerification'));
    expect(probe()).toMatch(/^signed-in\|u1/);
  });

  it('falls back to the redirect when the popup is blocked, staying a guest', async () => {
    sdk.signInWithPopup.mockRejectedValueOnce(authError('auth/popup-blocked'));
    await asGuest();
    await act(async () => auth().signInWithGoogle());
    expect(sdk.signInWithRedirect).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(REDIRECT_FLAG)).toBe('1');
    expect(probe()).toMatch(/^guest/);
  });

  it('finishes a pending redirect once on start and clears its flag', async () => {
    window.sessionStorage.setItem(REDIRECT_FLAG, '1');
    sdk.getRedirectResult.mockResolvedValueOnce({ user: fakeUser('u7') });
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u7/));
    expect(sdk.getRedirectResult).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(REDIRECT_FLAG)).toBeNull();
  });

  it('asks for the redirect result when Firebase is already loaded, then starts as usual', async () => {
    await loadFirebase();
    renderAuth();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(sdk.getRedirectResult).toHaveBeenCalledTimes(1);
  });

  it('rejects with the Firebase error and stays a guest', async () => {
    sdk.signInWithEmailAndPassword.mockRejectedValueOnce(authError('auth/invalid-credential'));
    await asGuest();
    await expect(auth().signInWithEmail('x@exemplo.com', 'errada123')).rejects.toMatchObject({
      code: 'auth/invalid-credential',
    });
    expect(probe()).toMatch(/^guest/);
  });

  it('signs Firebase out again when the session cannot be created', async () => {
    server.use(http.post(url('/api/auth/session'), () => new HttpResponse(null, { status: 500 })));
    await asGuest();
    await expect(auth().signInWithEmail('u1@exemplo.com', 'segredo123')).rejects.toBeTruthy();
    expect(log).toContain('signOut');
    expect(probe()).toMatch(/^guest/);
  });

  it('signs out: deletes the session, signs Firebase out and shows the guest list', async () => {
    signedInOnServer('u1');
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, items: [], episodes: [], ratings: [] }));
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in/));
    await act(async () => auth().signOut());
    expect(log).toContain('DELETE session');
    expect(log).toContain('signOut');
    expect(hasHint()).toBe(false);
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
  });
});
