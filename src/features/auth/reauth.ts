import type { User } from 'firebase/auth';
import type { FirebaseClient } from './firebase-client';
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
 *   accepts the result only as the same person; anyone else is signed out of Firebase again at once. A Google
 *   redirect is marked with the target uid, and its return trip applies the same rule (auth-flows, `completeRedirect`).
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
    password === undefined
      ? await googleSignIn(client, target.id)
      : await emailSignIn(client, target.email ?? '', password);
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

