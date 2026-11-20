import type { User } from 'firebase/auth';
import { WRONG_ACCOUNT } from './account-copy';
import { authErrorCode, authErrorMessage } from './errors';
import { loadFirebase, type FirebaseClient } from './firebase-client';
import { clearRedirectFlag, redirectReauthTarget, takeRedirectResult } from './sign-in';

export type RedirectReturn =
  | { kind: 'user'; client: FirebaseClient; user: User }
  | { kind: 'none' }
  /** Nothing to establish; `message` (when not null) says why. */
  | { kind: 'refused'; message: string | null };

/**
 * The return trip of a Google redirect, read once. One started to sign a user in again before deleting their account
 * (`reauth:<uid>`) accepts only that user: anyone else is signed out of Firebase at once, and no session may be minted
 * (the original cookie stays, so the caller goes on to restore it). Firebase's own refusal of another account
 * (`auth/user-mismatch`) is told the same way.
 */
export async function readRedirectReturn(): Promise<RedirectReturn> {
  const target = redirectReauthTarget();
  try {
    const client = await loadFirebase();
    const user = await takeRedirectResult(client);
    if (!user) return { kind: 'none' };
    if (target === null || user.uid === target) return { kind: 'user', client, user };
    try {
      await client.sdk.signOut(client.auth);
    } catch {
      // Best effort: nothing is minted either way.
    }
    return { kind: 'refused', message: WRONG_ACCOUNT };
  } catch (error) {
    clearRedirectFlag(); // Even when the SDK never loaded: a return trip is handled once, never in a loop.
    const mismatch = target !== null && authErrorCode(error) === 'auth/user-mismatch';
    return { kind: 'refused', message: mismatch ? WRONG_ACCOUNT : authErrorMessage(error) };
  }
}
