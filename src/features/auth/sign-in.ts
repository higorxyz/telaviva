import type { User } from 'firebase/auth';
import { authErrorCode } from './errors';
import type { FirebaseClient } from './firebase-client';

/**
 * Set just before leaving for the Google redirect, so the return trip knows to ask for its result: `1` for a sign-in,
 * `reauth:<uid>` for signing `<uid>` in again before deleting their account (the return trip accepts only them).
 */
export const REDIRECT_FLAG = 'telaviva:auth:redirect';
const REAUTH_PREFIX = 'reauth:';

/** The popup cannot work here (blocked, iOS standalone PWA...): the redirect, through the /__/auth proxy, can. */
const REDIRECT_CODES = new Set(['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment']);

function session(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function setFlag(value: string | null): void {
  try {
    if (value) session()?.setItem(REDIRECT_FLAG, value);
    else session()?.removeItem(REDIRECT_FLAG);
  } catch {
    // Storage blocked: the redirect still works, its result is then read only when Firebase is already loaded.
  }
}

function readFlag(): string | null {
  try {
    return session()?.getItem(REDIRECT_FLAG) ?? null;
  } catch {
    return null;
  }
}

export function clearRedirectFlag(): void {
  setFlag(null);
}

export function redirectPending(): boolean {
  return readFlag() !== null;
}

/**
 * The uid a pending redirect was started to sign in again (before deleting the account), or null when it was an
 * ordinary sign-in. A re-authentication flag without a uid comes back as `''`, which matches no user: the return trip
 * refuses it rather than taking it for an ordinary sign-in.
 */
export function redirectReauthTarget(): string | null {
  const flag = readFlag();
  return flag?.startsWith(REAUTH_PREFIX) ? flag.slice(REAUTH_PREFIX.length) : null;
}

/** The popup; when it cannot open, the redirect, marked with `flag` (resolves null: the page is leaving). */
async function popupOrRedirect<T>(popup: () => Promise<T>, redirect: () => Promise<unknown>, flag: string) {
  try {
    return await popup();
  } catch (error) {
    const code = authErrorCode(error);
    if (code === null || !REDIRECT_CODES.has(code)) throw error;
  }
  setFlag(flag);
  try {
    await redirect();
  } catch (error) {
    setFlag(null);
    throw error;
  }
  return null;
}

/**
 * Google sign-in: the popup, or the redirect when the popup cannot open (resolves null: the page is leaving).
 * `reauthTarget`: a sign-in made only to sign that uid in again; a redirect's return trip accepts no one else.
 */
export async function googleSignIn({ auth, sdk }: FirebaseClient, reauthTarget?: string): Promise<User | null> {
  const provider = new sdk.GoogleAuthProvider();
  const flag = reauthTarget ? `${REAUTH_PREFIX}${reauthTarget}` : '1';
  const credential = await popupOrRedirect(
    () => sdk.signInWithPopup(auth, provider),
    () => sdk.signInWithRedirect(auth, provider),
    flag,
  );
  return credential?.user ?? null;
}

/**
 * Google again for the user already signed in here, to refresh their sign-in time. Firebase refuses another Google
 * account (`auth/user-mismatch`) and keeps the current user. Resolves false when leaving for the redirect.
 */
export async function googleReauth({ sdk }: FirebaseClient, user: User): Promise<boolean> {
  const provider = new sdk.GoogleAuthProvider();
  const credential = await popupOrRedirect(
    () => sdk.reauthenticateWithPopup(user, provider),
    () => sdk.reauthenticateWithRedirect(user, provider),
    `${REAUTH_PREFIX}${user.uid}`,
  );
  return credential !== null;
}

/** The password again for the user already signed in here, to refresh their sign-in time. */
export async function passwordReauth({ sdk }: FirebaseClient, user: User, email: string, password: string) {
  await sdk.reauthenticateWithCredential(user, sdk.EmailAuthProvider.credential(email, password));
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
    setFlag(null);
  }
}
