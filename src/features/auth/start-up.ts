import { quietly, type AuthState } from './auth-state';
import type { DeviceSession, SignOutState } from './device-session';
import { isFirebaseLoaded, loadFirebase } from './firebase-client';
import { clearAuthHint, fetchMe, hasAuthHint, type MeResult, type SessionUser } from './session-client';
import { redirectPending } from './sign-in';

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
 *   kept on the device, without a toast, and asks again once the connection is back. Only a true 401 ends the session.
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

  /** Signed in from the device; once online, `/api/auth/me` decides (a 401 renews, or expires the session). */
  function signInOffline(started: number, user: SessionUser) {
    state.signedIn(user);
    window.addEventListener(
      'online',
      () => {
        if (started !== state.generation || state.uid !== user.id) return;
        void (async () => {
          const me = await fetchMe();
          if (started !== state.generation || state.uid !== user.id) return;
          if (me.kind === 'user') state.signedIn(me.user);
          else if (me.kind === 'unauthenticated') await renew();
        })();
      },
      { once: true },
    );
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
