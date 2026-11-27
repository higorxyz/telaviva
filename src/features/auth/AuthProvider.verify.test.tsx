import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { resetFirebaseClient } from './firebase-client';
import { authConfig, fakeAuth, fakeUser, log, resetFakeFirebase, sdk } from './test-firebase';
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
const minted = () => log.filter((entry) => entry.startsWith('POST session'));

beforeEach(() => {
  resetFakeFirebase();
  resetFirebaseClient();
  authConfig.enabled = true;
  installDefaultApi();
  // The server reads email_verified from the fresh token it is given.
  server.use(
    http.post(url('/api/auth/session'), async ({ request }) => {
      const { idToken } = (await request.json()) as { idToken: string };
      log.push(`POST session:${idToken}`);
      return HttpResponse.json({ user: sessionUser(idToken.replace('token-', ''), { emailVerified: true }) });
    }),
  );
});
afterEach(() => {
  clearCookies();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

async function signedInUnverifiedCookie(firebaseVerified: boolean) {
  signedInOnServer('u1', { emailVerified: false });
  fakeAuth.currentUser = fakeUser('u1', { emailVerified: firebaseVerified });
  renderAuth();
  await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
}

describe('AuthProvider: refresh after the e-mail is confirmed', () => {
  it('mints a fresh session once Firebase says the e-mail is confirmed, so the cookie says so too', async () => {
    await signedInUnverifiedCookie(true);
    await act(async () => auth().refresh());
    expect(log).toContain('getIdToken:true');
    expect(minted()).toEqual(['POST session:token-u1']);
    expect(auth().user?.emailVerified).toBe(true);
  });

  it('mints nothing while the e-mail is still unconfirmed', async () => {
    await signedInUnverifiedCookie(false);
    await act(async () => auth().refresh());
    expect(minted()).toEqual([]);
    expect(auth().user?.emailVerified).toBe(false);
  });

  it('mints nothing when the session already says confirmed', async () => {
    signedInOnServer('u1', { emailVerified: true });
    fakeAuth.currentUser = fakeUser('u1', { emailVerified: true });
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    await act(async () => auth().refresh());
    expect(minted()).toEqual([]);
  });

  it('sends the confirmation with a link back to /conta', async () => {
    await signedInUnverifiedCookie(false);
    await act(async () => auth().sendVerification());
    expect(sdk.sendEmailVerification).toHaveBeenCalledWith(fakeAuth.currentUser, {
      url: `${window.location.origin}/conta`,
    });
  });
});
