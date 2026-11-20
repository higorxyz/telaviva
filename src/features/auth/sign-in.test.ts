import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FirebaseClient } from './firebase-client';
import { emailSignUp, googleSignIn, redirectPending, REDIRECT_FLAG, takeRedirectResult } from './sign-in';
import { authError, fakeAuth, fakeUser, log, resetFakeFirebase, sdk } from './test-firebase';

const client = { auth: fakeAuth, sdk } as unknown as FirebaseClient;

beforeEach(() => resetFakeFirebase());
afterEach(() => window.sessionStorage.clear());

describe('googleSignIn', () => {
  it('signs in with the popup', async () => {
    const user = await googleSignIn(client);
    expect(user?.uid).toBe('u1');
    expect(sdk.signInWithRedirect).not.toHaveBeenCalled();
  });

  it.each(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'])(
    'falls back to the redirect on %s, flagging it first',
    async (code) => {
      sdk.signInWithPopup.mockRejectedValueOnce(authError(code));
      sdk.signInWithRedirect.mockImplementationOnce(async () => {
        log.push(`flag:${window.sessionStorage.getItem(REDIRECT_FLAG)}`);
      });
      expect(await googleSignIn(client)).toBeNull();
      expect(log).toEqual(['flag:1']);
      expect(redirectPending()).toBe(true);
    },
  );

  it('passes any other popup error on, without redirecting', async () => {
    sdk.signInWithPopup.mockRejectedValueOnce(authError('auth/popup-closed-by-user'));
    await expect(googleSignIn(client)).rejects.toMatchObject({ code: 'auth/popup-closed-by-user' });
    expect(sdk.signInWithRedirect).not.toHaveBeenCalled();
    expect(redirectPending()).toBe(false);
  });

  it('drops the flag when the redirect itself fails', async () => {
    sdk.signInWithPopup.mockRejectedValueOnce(authError('auth/popup-blocked'));
    sdk.signInWithRedirect.mockRejectedValueOnce(authError('auth/network-request-failed'));
    await expect(googleSignIn(client)).rejects.toMatchObject({ code: 'auth/network-request-failed' });
    expect(redirectPending()).toBe(false);
  });
});

describe('emailSignUp', () => {
  it('sets the name and refreshes the token so the session gets the name claim', async () => {
    const user = await emailSignUp(client, 'Ana', 'ana@exemplo.com', 'segredo123');
    expect(user.displayName).toBe('Ana');
    expect(log).toEqual(['createUser', 'updateProfile:Ana', 'getIdToken:true']);
  });

  it('skips the profile update without a name', async () => {
    await emailSignUp(client, '  ', 'ana@exemplo.com', 'segredo123');
    expect(log).toEqual(['createUser']);
  });
});

describe('takeRedirectResult', () => {
  it('returns the user of a finished redirect once and clears the flag', async () => {
    window.sessionStorage.setItem(REDIRECT_FLAG, '1');
    sdk.getRedirectResult.mockResolvedValueOnce({ user: fakeUser('u9') });
    expect((await takeRedirectResult(client))?.uid).toBe('u9');
    expect(redirectPending()).toBe(false);
    expect(sdk.getRedirectResult).toHaveBeenCalledTimes(1);
  });

  it('clears the flag even when the redirect failed', async () => {
    window.sessionStorage.setItem(REDIRECT_FLAG, '1');
    sdk.getRedirectResult.mockRejectedValueOnce(authError('auth/account-exists-with-different-credential'));
    await expect(takeRedirectResult(client)).rejects.toBeTruthy();
    expect(redirectPending()).toBe(false);
  });
});
