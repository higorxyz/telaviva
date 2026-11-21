import type { User } from 'firebase/auth';
import { createAuthState, quietly, type AuthDeps } from './auth-state';
import { authErrorMessage } from './errors';
import { isFirebaseLoaded, loadFirebase, type FirebaseClient } from './firebase-client';
import { clearAuthHint, createSession, deleteSession, fetchMe, hasAuthHint, type SessionUser } from './session-client';
import { reauthFirebase } from './reauth';
import { readRedirectReturn } from './redirect-return';
import { createSessionRenewal } from './session-renewal';
import { emailSignIn, emailSignUp, googleSignIn, redirectPending } from './sign-in';

export type { AuthSnapshot } from './auth-state';
export { SESSION_EXPIRED } from './session-renewal';

/** `renewed`: a recent session now; `leaving`: off to the Google redirect; `aborted`: the identity here changed. */
export type ReauthOutcome = 'renewed' | 'leaving' | 'aborted';

/** The confirmation e-mail links back to the account page of this very site (preview or production). */
const verificationSettings = () => ({ url: `${window.location.origin}/conta` });

/**
 * The sign-in state machine, created once per AuthProvider. It lives outside the components below the library (which
 * remount on every identity change), so a sign-in started on a page finishes even after that page is gone. The
 * shared state is in auth-state.ts; renewal and expiry in session-renewal.ts.
 */
export function createAuthFlows(deps: AuthDeps) {
  const state = createAuthState(deps);
  const { renew, remintVerified, patientMe } = createSessionRenewal(state);

  /** ID token → session cookie → signed in. A failure signs Firebase out again, so both sides agree. */
  async function establish({ auth, sdk }: FirebaseClient, user: User): Promise<SessionUser> {
    let sessionUser: SessionUser;
    try {
      sessionUser = await createSession(await user.getIdToken());
    } catch (error) {
      await quietly(() => sdk.signOut(auth));
      throw error;
    }
    state.generation += 1;
    state.adopt(user, sessionUser);
    return sessionUser;
  }

  async function withSignIn(
    obtain: (client: FirebaseClient) => Promise<User | null>,
    after?: (client: FirebaseClient, user: User) => Promise<void>,
  ): Promise<void> {
    const client = await loadFirebase();
    const user = await obtain(client);
    if (!user) return; // Leaving for the Google redirect.
    await establish(client, user);
    if (after) await quietly(() => after(client, user));
  }

  /** A Google redirect's return trip (see `readRedirectReturn`); true when it signed someone in. */
  async function completeRedirect(): Promise<boolean> {
    const back = await readRedirectReturn();
    let message = back.kind === 'refused' ? back.message : null;
    if (back.kind === 'user') {
      try {
        await establish(back.client, back.user);
        return true;
      } catch (error) {
        message = authErrorMessage(error);
      }
    }
    if (message) state.notify({ message, tone: 'error' });
    return false;
  }

  /** Back to the visitor; `endSession` also ends the session on the server (a deleted account has none left). */
  async function leave(endSession: boolean, notice?: string) {
    state.generation += 1;
    state.uid = null; // A 401 from here on is the sign-out itself, not a session to renew.
    // A mint still in flight would set the cookies again after the DELETE: let it land first.
    await state.mintsSettled();
    if (endSession) await deleteSession();
    clearAuthHint();
    await quietly(async () => {
      const { auth, sdk } = await loadFirebase();
      await sdk.signOut(auth);
    });
    state.guest(notice);
  }

  const flows = {
    currentUid: () => state.uid,
    takeNotices: state.takeNotices,

    async start() {
      const started = state.generation;
      if ((redirectPending() || isFirebaseLoaded()) && (await completeRedirect())) return;
      if (started !== state.generation) return;
      if (!hasAuthHint()) return state.guest();
      const me = await patientMe(started);
      if (started !== state.generation) return;
      if (me.kind === 'user') return state.signedIn(me.user);
      if (me.kind === 'unauthenticated') return void (await renew());
      if (me.kind === 'off') clearAuthHint();
      state.guest();
    },

    /** From the account library on a 401: renews only while someone is signed in (a retired request is ignored). */
    onUnauthenticated: (): Promise<boolean> => (state.uid === null ? Promise.resolve(false) : renew()),

    signInWithGoogle: () => withSignIn(googleSignIn),
    signInWithEmail: (email: string, password: string) => withSignIn((c) => emailSignIn(c, email, password)),
    signUpWithEmail: (name: string, email: string, password: string) =>
      withSignIn(
        (c) => emailSignUp(c, name, email, password),
        (c, user) => c.sdk.sendEmailVerification(user, verificationSettings()),
      ),

    async sendVerification() {
      const { auth, sdk } = await loadFirebase();
      if (!auth.currentUser) throw new Error('No Firebase user to verify');
      await sdk.sendEmailVerification(auth.currentUser, verificationSettings());
    },

    signOut: () => leave(true),

    /** The account was deleted (the server already cleared the cookies): forget it here, and say so once a visitor. */
    accountDeleted: (notice: string) => leave(false, notice),

    /**
     * Signs the current user in again (see `reauthFirebase`) and mints a session from a refreshed ID token, so its
     * `auth_time` is recent enough to delete the account. `aborted` when the identity here changed meanwhile: before
     * the minting, nothing is minted; after it, the cookie may now name someone else than this tab shows, so it looks
     * again at who is in (`refresh`).
     */
    async reauthenticate(password?: string): Promise<ReauthOutcome> {
      const target = state.uid;
      if (target === null) throw new Error('No one is signed in');
      const user = await reauthFirebase(await loadFirebase(), { id: target, email: state.email }, password);
      if (!user) return 'leaving';
      if (state.uid !== target) return 'aborted';
      const sessionUser = await state.mint(user);
      if (state.uid !== target || sessionUser.id !== target) {
        await quietly(() => flows.refresh());
        return 'aborted';
      }
      state.adopt(user, sessionUser);
      return 'renewed';
    },

    /** Reloads the Firebase user and the session user (re-minting a verified session: see `remintVerified`). */
    async refresh() {
      if (state.uid === null) return;
      const started = state.generation;
      let reloaded: User | null = null;
      await quietly(async () => {
        const { auth } = await loadFirebase();
        const user = auth.currentUser;
        if (!user) return;
        await user.reload();
        deps.setFirebaseVerified({ uid: user.uid, verified: user.emailVerified });
        reloaded = user;
      });
      if (started !== state.generation || state.uid === null) return;
      if (await remintVerified(reloaded, started)) return;
      const me = await fetchMe();
      if (started !== state.generation || state.uid === null) return;
      if (me.kind === 'user') state.signedIn(me.user);
      else if (me.kind === 'unauthenticated') await renew();
    },
  };
  return flows;
}

export type AuthFlows = ReturnType<typeof createAuthFlows>;
