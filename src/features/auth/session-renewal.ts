import type { User } from 'firebase/auth';
import { quietly, type AuthState } from './auth-state';
import type { DeviceSession } from './device-session';
import { endsSession } from './errors';
import { isFirebaseLoaded, loadFirebase } from './firebase-client';
import { clearAuthHint, deleteSession, fetchMe, type MeResult } from './session-client';

export const SESSION_EXPIRED = 'Sua sessão expirou. Entre de novo para sincronizar.';

/** Waits before asking /api/auth/me again after a passing failure (a 503, offline). */
export const ME_RETRY_MS = [300, 900];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The browser knows it is offline (`true` proves nothing). */
const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Keeping the session cookie alive and truthful: renewal, expiry, the verified re-mint and a patient `me`. `device`
 * keeps the account's copy and queue on the device in step (see device-session.ts).
 */
export function createSessionRenewal(state: AuthState, device: DeviceSession) {
  let renewing: Promise<boolean> | null = null;

  /**
   * The session is gone for good: back to the visitor's library, saying why. The account's saved copy goes (it is
   * downloaded again on the next sign-in); its queue stays, to be sent when that account signs in again. At start-up
   * nobody is signed in yet, and the session was the last identity's.
   */
  async function expire() {
    const uid = state.uid ?? (await device.lastUid());
    state.generation += 1;
    if (isFirebaseLoaded()) {
      await quietly(async () => {
        const { auth, sdk } = await loadFirebase();
        await sdk.signOut(auth);
      });
    }
    clearAuthHint();
    await deleteSession();
    if (uid) await device.sessionEnded(uid);
    state.guest(SESSION_EXPIRED);
  }

  /** Mints a new session from the Firebase user; true when it is the same user's. Concurrent calls share one try. */
  function renew(): Promise<boolean> {
    renewing ??= (async () => {
      const before = state.uid;
      const started = state.generation;
      let definitive = true; // No Firebase user: nothing can renew the session.
      // A "Sair" still pending (here or in another tab): the Firebase SDK may still hold that user, and minting from
      // it would sign the person back in. The visitor, in silence: that is what they asked for.
      if (await device.isSignOutPending()) {
        if (started !== state.generation) return false;
        state.generation += 1;
        clearAuthHint();
        state.guest();
        return false;
      }
      try {
        const { auth } = await loadFirebase();
        const user = auth.currentUser;
        if (user) {
          const sessionUser = await state.mint(user);
          if (started !== state.generation) return false;
          state.adopt(user, sessionUser);
          return sessionUser.id === before;
        }
      } catch (error) {
        definitive = endsSession(error);
      }
      if (started !== state.generation) return false;
      // A passing failure (offline, 5xx, the SDK not loading) keeps the Firebase user and the hint, so the next load
      // tries again; meanwhile the visitor mode shows, without a toast.
      if (definitive) await expire();
      else state.guest();
      return false;
    })().finally(() => {
      renewing = null;
    });
    return renewing;
  }

  /**
   * Once Firebase says the e-mail is confirmed but the session cookie (which froze `email_verified` when it was
   * minted) does not, mints a fresh session from a new ID token (its fresh `iat` is accepted), so the next full load
   * does not flash the verification banner again. True when it did.
   */
  async function remintVerified(user: User | null, started: number): Promise<boolean> {
    if (!user?.emailVerified || user.uid !== state.uid || state.sessionVerified) return false;
    try {
      const sessionUser = await state.mint(user);
      if (started !== state.generation || sessionUser.id !== state.uid) return false;
      state.adopt(user, sessionUser);
      return true;
    } catch {
      return false; // The old cookie still works; the next refresh tries again.
    }
  }

  /**
   * `/api/auth/me`, asked again (twice at most, briefly apart) after a passing failure, while the page still waits
   * on sign-in: one dropped request must not show a signed-in person the visitor's list. When the browser knows it is
   * offline, asking again cannot help: the start-up goes on to the identity kept on the device at once.
   */
  async function patientMe(started: number): Promise<MeResult> {
    let me = await fetchMe();
    for (const ms of ME_RETRY_MS) {
      if (me.kind !== 'error' || started !== state.generation || browserOffline()) break;
      await wait(ms);
      me = await fetchMe();
    }
    return me;
  }

  return { renew, expire, remintVerified, patientMe };
}
