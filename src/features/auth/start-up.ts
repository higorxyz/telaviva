import { quietly, type AuthState } from './auth-state';
import type { DeviceSession, SignOutState } from './device-session';
import { isFirebaseLoaded, loadFirebase } from './firebase-client';
import { clearAuthHint, fetchMe, hasAuthHint, type MeResult, type SessionUser } from './session-client';
import { redirectPending } from './sign-in';

/**
 * Signed in from the device, how long until `/api/auth/me` is asked again without any event: 30 s, doubling while it
 * still fails, up to 5 min. A slow but reachable server (or a 5xx) never fires `online`, so a timer must ask too.
 */
export const OFFLINE_RECHECK_MS = 30_000;
export const OFFLINE_RECHECK_MAX_MS = 5 * 60_000;

type Deps = {
  state: AuthState;
  device: DeviceSession;
  renew(): Promise<boolean>;
  patientMe(started: number): Promise<MeResult>;
  /** A Google redirect's return trip; true when it signed someone in. */
  completeRedirect(): Promise<boolean>;
};

/**
 * The page load's sign-in check (once per AuthProvider), with the offline rules of spec §6.3:
 *
 * - A pending "Sair" (its DELETE never reached the server) goes first: its DELETE is the first request, and while it
 *   has not landed the `tv_auth` hint is ignored and nothing renews a session: the app is a visitor.
 * - With the hint, `/api/auth/me` that fails by network or 5xx (after `patientMe`'s retries) signs in with the identity
 *   kept on the device, without a toast, and asks again on `online`, when the tab comes back into view, and on a
 *   timer (OFFLINE_RECHECK_MS, backing off). Only a true 401 ends the session.
 * - A visitor's start (no hint, no redirect) never waits on the device store.
 */
export function createStartUp({ state, device, renew, patientMe, completeRedirect }: Deps) {
  /** The Firebase SDK may still hold the user who signed out (it could not load offline): sign that one out. */
  async function forgetFirebaseUser(signOut: SignOutState) {
    if (signOut.state === 'none' || signOut.uid === null) return;
    await quietly(async () => {
      const { auth, sdk } = await loadFirebase();
      if (auth.currentUser?.uid === signOut.uid) await sdk.signOut(auth);
    });
  }

  /**
   * Signed in from the device; `/api/auth/me` decides as soon as it answers (a 401 renews, or expires the session).
   * Asked on `online`, when the tab comes back into view and on a backing-off timer, one request at a time, until it
   * answers or the session changed (sign-out, another account).
   */
  function signInOffline(started: number, user: SessionUser) {
    state.signedIn(user);
    let checking = false;
    let delay = OFFLINE_RECHECK_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current = () => started === state.generation && state.uid === user.id;
    const stop = () => {
      clearTimeout(timer);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(check, delay);
      delay = Math.min(delay * 2, OFFLINE_RECHECK_MAX_MS);
    };
    function onVisible() {
      if (document.visibilityState === 'visible') check();
    }
    function check() {
      if (!current()) return stop();
      if (checking) return;
      checking = true;
      void (async () => {
        try {
          const me = await fetchMe();
          if (!current()) return stop();
          if (me.kind === 'user') {
            stop();
            state.signedIn(me.user);
          } else if (me.kind === 'unauthenticated') {
            stop();
            await renew();
          } else if (me.kind === 'off') {
            stop();
          } else {
            schedule();
          }
        } finally {
          checking = false;
        }
      })();
    }
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', onVisible);
    schedule();
  }

  return async function start() {
    const started = state.generation;
    const redirect = redirectPending() || isFirebaseLoaded();
    if (!redirect && !hasAuthHint()) {
      void device.settleSignOut().then(forgetFirebaseUser);
      return state.guest();
    }
    const signOut = await device.settleSignOut();
    if (started !== state.generation) return;
    if (redirect && (await completeRedirect())) return;
    if (started !== state.generation) return;
    if (signOut.state !== 'none') {
      clearAuthHint();
      void forgetFirebaseUser(signOut);
      return state.guest();
    }
    if (!hasAuthHint()) return state.guest();
    const me = await patientMe(started);
    if (started !== state.generation) return;
    if (me.kind === 'user') return state.signedIn(me.user);
    if (me.kind === 'unauthenticated') return void (await renew());
    if (me.kind === 'off') clearAuthHint();
    if (me.kind === 'error') {
      const kept = await device.identity();
      if (started !== state.generation) return;
      if (kept) return signInOffline(started, kept);
    }
    state.guest();
  };
}
