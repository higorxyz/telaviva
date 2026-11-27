import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFirebaseClient } from './firebase-client';
import { REDIRECT_FLAG } from './sign-in';
import { authConfig, authError, fakeAuth, fakeUser, log, resetFakeFirebase, sdk } from './test-firebase';
import {
  auth as holder,
  clearCookies,
  installDefaultApi,
  probe,
  renderAuth,
  signedInOnServer,
} from './test-auth';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

const auth = () => holder.current!;
const WRONG_ACCOUNT = 'Entre com a mesma conta que você quer excluir.';

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

/** Back from a Google redirect started to sign `u1` in again before deleting the account. */
async function returnFromReauthRedirect() {
  window.sessionStorage.setItem(REDIRECT_FLAG, 'reauth:u1');
  signedInOnServer('u1'); // u1's session cookie is still there.
  renderAuth();
}

describe('AuthProvider: back from a redirect started to sign in again before deleting', () => {
  it('refuses another account: signs Firebase out, mints nothing, keeps the original session, and says so', async () => {
    sdk.getRedirectResult.mockImplementationOnce(async () => {
      log.push('getRedirectResult');
      fakeAuth.currentUser = fakeUser('u2');
      return { user: fakeAuth.currentUser };
    });
    await returnFromReauthRedirect();

    expect(await screen.findByText(WRONG_ACCOUNT)).toBeInTheDocument();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    expect(log).toContain('signOut');
    expect(log.some((e) => e.startsWith('POST session'))).toBe(false);
    expect(window.sessionStorage.getItem(REDIRECT_FLAG)).toBeNull();
  });

  it('treats a re-authentication flag with an empty uid as a refusal, never as an ordinary sign-in', async () => {
    window.sessionStorage.setItem(REDIRECT_FLAG, 'reauth:');
    sdk.getRedirectResult.mockImplementationOnce(async () => {
      fakeAuth.currentUser = fakeUser('u2');
      return { user: fakeAuth.currentUser };
    });
    renderAuth();

    expect(await screen.findByText(WRONG_ACCOUNT)).toBeInTheDocument();
    expect(log).toContain('signOut');
    expect(log.some((e) => e.startsWith('POST session'))).toBe(false);
  });

  it('tells a refused re-authentication (auth/user-mismatch) as signing in with the same account', async () => {
    sdk.getRedirectResult.mockRejectedValueOnce(authError('auth/user-mismatch'));
    await returnFromReauthRedirect();

    expect(await screen.findByText(WRONG_ACCOUNT)).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível entrar agora. Tente de novo.')).toBeNull();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    expect(log.some((e) => e.startsWith('POST session'))).toBe(false);
  });

  it('accepts the same person: a new session for u1', async () => {
    sdk.getRedirectResult.mockImplementationOnce(async () => {
      fakeAuth.currentUser = fakeUser('u1');
      return { user: fakeAuth.currentUser };
    });
    await returnFromReauthRedirect();

    await waitFor(() => expect(log).toContain('POST session:token-u1'));
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    expect(screen.queryByText(WRONG_ACCOUNT)).toBeNull();
  });
});

describe('AuthProvider: reauthenticate', () => {
  it('aborts without minting a session when the identity changes while signing in again', async () => {
    signedInOnServer('u1');
    fakeAuth.currentUser = fakeUser('u1');
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    sdk.reauthenticateWithPopup.mockImplementationOnce(async (user) => {
      await auth().signOut(); // This tab signs out while the popup is open.
      return { user };
    });

    let result: unknown;
    await act(async () => {
      result = await auth().reauthenticate();
    });
    expect(result).toBe('aborted');
    expect(log.some((e) => e.startsWith('POST session'))).toBe(false);
    expect(probe()).toMatch(/^guest/);
  });
});
