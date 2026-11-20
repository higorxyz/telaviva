import type { User } from 'firebase/auth';
import { authErrorCode } from './errors';
import type { FirebaseClient } from './firebase-client';

/** Set just before leaving for the Google redirect, so the return trip knows to ask for its result. */
export const REDIRECT_FLAG = 'telaviva:auth:redirect';

/** The popup cannot work here (blocked, iOS standalone PWA...): the redirect, through the /__/auth proxy, can. */
const REDIRECT_CODES = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment']);

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function setFlag(on: boolean): void {
  try {
    if (on) session()?.setItem(REDIRECT_FLAG, '1');
    else session()?.removeItem(REDIRECT_FLAG);
  } catch {
    // Storage blocked: the redirect still works, its result is then read only when Firebase is already loaded.
  }
}

export function clearRedirectFlag(): void {
  setFlag(false);
}

export function redirectPending(): boolean {
  try {
    return session()?.getItem(REDIRECT_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Google sign-in: the popup, or the redirect when the popup cannot open (resolves null: the page is leaving). */
export async function googleSignIn({ auth, sdk }: FirebaseClient): Promise<User | null> {
  const provider = new sdk.GoogleAuthProvider();
  try {
    return (await sdk.signInWithPopup(auth, provider)).user;
  } catch (error) {
    const code = authErrorCode(error);
    if (code === null || !REDIRECT_CODES.has(code)) throw error;
  }
  setFlag(true);
  try {
    await sdk.signInWithRedirect(auth, provider);
  } catch (error) {
    setFlag(false);
    throw error;
  }
  return null;
}

export async function emailSignIn({ auth, sdk }: FirebaseClient, email: string, password: string): Promise<User> {
  return (await sdk.signInWithEmailAndPassword(auth, email, password)).user;
}

/**
 * Creates the account. The name goes into the profile, and the token is refreshed afterwards, so the token that mints
 * the session already carries the `name` claim.
 */
export async function emailSignUp(
  { auth, sdk }: FirebaseClient,
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const { user } = await sdk.createUserWithEmailAndPassword(auth, email, password);
  const displayName = name.trim();
  if (displayName) {
    await sdk.updateProfile(user, { displayName });
    await user.getIdToken(true);
  }
  return user;
}

/** The user of a finished Google redirect, asked once; the flag is dropped whatever the outcome, so it never loops. */
export async function takeRedirectResult({ auth, sdk }: FirebaseClient): Promise<User | null> {
  try {
    return (await sdk.getRedirectResult(auth))?.user ?? null;
  } finally {
    setFlag(false);
  }
}
