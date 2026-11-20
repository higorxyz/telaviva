import type { User } from 'firebase/auth';
import type { FirebaseClient } from './firebase-client';
import { createSession, type SessionUser } from './session-client';
import { emailSignIn, googleReauth, googleSignIn, passwordReauth } from './sign-in';

/** Signing in again was done with another account than the one signed in (and about to be deleted). */
export class ReauthMismatchError extends Error {
  constructor() {
    super('Signed in again as someone else');
    this.name = 'ReauthMismatchError';
  }
}

export type ReauthTarget = { id: string; email: string | null };

/**
 * Signs `target` in again, so a session minted afterwards counts as a recent sign-in (needed to delete the account).
 * `password` given: e-mail and password; otherwise Google.
 *
 * - With the user still in Firebase's storage, it re-authenticates them: Firebase refuses another account
 *   (`auth/user-mismatch`) and the current user stays.
 * - Without it (the browser cleared that storage while the session cookie lived on), it signs in from scratch and
 *   accepts the result only as the same person; anyone else is signed out of Firebase again at once.
 *
 * Resolves the user, or null when leaving for the Google redirect.
 */
export async function reauthFirebase(
  client: FirebaseClient,
  target: ReauthTarget,
  password?: string,
): Promise<User | null> {
  const current = client.auth.currentUser;
  if (current && current.uid === target.id) {
    if (password === undefined) return (await googleReauth(client, current)) ? current : null;
    const email = current.email ?? target.email;
    if (!email) throw new Error('No e-mail to sign in with');
    await passwordReauth(client, current, email, password);
    return current;
  }

  const user =
    password === undefined ? await googleSignIn(client) : await emailSignIn(client, target.email ?? '', password);
  if (!user) return null;
  if (user.uid !== target.id) {
    try {
      await client.sdk.signOut(client.auth);
    } catch {
      // Best effort: the session cookie still belongs to the target, and nothing is deleted.
    }
    throw new ReauthMismatchError();
  }
  return user;
}

/**
 * Signs the current user in again and mints a new session from a freshly refreshed ID token, so the cookie's
 * `auth_time` is recent. Null when leaving for the Google redirect (the return trip mints the session).
 */
export async function reauthenticateSession(
  client: FirebaseClient,
  target: ReauthTarget,
  password?: string,
): Promise<{ user: User; sessionUser: SessionUser } | null> {
  const user = await reauthFirebase(client, target, password);
  if (!user) return null;
  const sessionUser = await createSession(await user.getIdToken(true));
  if (sessionUser.id !== target.id) throw new ReauthMismatchError();
  return { user, sessionUser };
}
