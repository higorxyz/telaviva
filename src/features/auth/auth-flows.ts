import type { User } from 'firebase/auth';
import type { ToastInput } from '@/ui/toast/useToast';
import type { AuthStatus } from './auth-context';
import { authErrorMessage, endsSession } from './errors';
import { isFirebaseLoaded, loadFirebase, type FirebaseClient } from './firebase-client';
import { clearAuthHint, createSession, deleteSession, fetchMe, hasAuthHint, type SessionUser } from './session-client';
import { reauthenticateSession } from './reauth';
import { clearRedirectFlag, emailSignIn, emailSignUp, googleSignIn, redirectPending, takeRedirectResult } from './sign-in';

export const SESSION_EXPIRED = 'Sua sessão expirou. Entre de novo para sincronizar.';

export type AuthSnapshot = { status: AuthStatus; user: SessionUser | null };

type Deps = {
  setSnapshot(snapshot: AuthSnapshot): void;
  setFirebaseVerified(value: { uid: string; verified: boolean }): void;
  /** A toast is waiting in `takeNotices()`: the provider shows it once the state change it goes with is committed. */
  onNotice(): void;
};

const quietly = async (work: () => Promise<unknown>) => {
  try {
    await work();
  } catch {
    // Best effort.
  }
};

/**
 * The sign-in state machine, created once per AuthProvider. It lives outside the components below the library (which
 * remount on every identity change), so a sign-in started on a page finishes even after that page is gone.
 *
 * `generation` changes on every explicit sign-in or sign-out: a renewal or a start-up check that began before one
 * drops its result instead of undoing it.
 */
export function createAuthFlows(deps: Deps) {
  let uid: string | null = null;
  let email: string | null = null;
  let generation = 0;
  let renewing: Promise<boolean> | null = null;
  const notices: ToastInput[] = [];

  function notify(toast: ToastInput) {
    notices.push(toast);
    deps.onNotice();
  }

  function signedIn(user: SessionUser) {
    uid = user.id;
    email = user.email;
    deps.setSnapshot({ status: 'signed-in', user });
  }

  /** Signed in with a session just minted from this Firebase user. */
  function adopt(user: User, sessionUser: SessionUser) {
    deps.setFirebaseVerified({ uid: user.uid, verified: user.emailVerified });
    signedIn(sessionUser);
  }

  function guest(notice?: string) {
    uid = null;
    email = null;
    deps.setSnapshot({ status: 'guest', user: null });
    if (notice) notify({ message: notice });
  }

  /** ID token → session cookie → signed in. A failure signs Firebase out again, so both sides agree. */
  async function establish({ auth, sdk }: FirebaseClient, user: User, forceRefresh = false): Promise<SessionUser> {
    let sessionUser: SessionUser;
    try {
      sessionUser = await createSession(await user.getIdToken(forceRefresh));
    } catch (error) {
      await quietly(() => sdk.signOut(auth));
      throw error;
    }
    generation += 1;
    adopt(user, sessionUser);
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

  /** The session is gone for good: back to the visitor's library, saying why. */
  async function expire() {
    generation += 1;
    if (isFirebaseLoaded()) await quietly(async () => {
      const { auth, sdk } = await loadFirebase();
      await sdk.signOut(auth);
    });
    clearAuthHint();
    await deleteSession();
    guest(SESSION_EXPIRED);
  }

  function renew(): Promise<boolean> {
    renewing ??= (async () => {
      const before = uid;
      const started = generation;
      let definitive = true; // No Firebase user: nothing can renew the session.
      try {
        const { auth } = await loadFirebase();
        const user = auth.currentUser;
        if (user) {
          const sessionUser = await createSession(await user.getIdToken(true));
          if (started !== generation) return false;
          adopt(user, sessionUser);
          return sessionUser.id === before;
        }
      } catch (error) {
        definitive = endsSession(error);
      }
      if (started !== generation) return false;
      // A passing failure (offline, 5xx, the SDK not loading) keeps the Firebase user and the hint, so the next load
      // tries again; meanwhile the visitor mode shows, without a toast.
      if (definitive) await expire();
      else guest();
      return false;
    })().finally(() => {
      renewing = null;
    });
    return renewing;
  }

  async function completeRedirect(): Promise<boolean> {
    try {
      const client = await loadFirebase();
      const user = await takeRedirectResult(client);
      if (!user) return false;
      await establish(client, user);
      return true;
    } catch (error) {
      clearRedirectFlag(); // Even when the SDK never loaded: a return trip is handled once, never in a loop.
      const message = authErrorMessage(error);
      if (message) notify({ message, tone: 'error' });
      return false;
    }
  }

  /** Back to the visitor; `endSession` also ends the session on the server (a deleted account has none left). */
  async function leave(endSession: boolean, notice?: string) {
    generation += 1;
    uid = null; // A 401 from here on is the sign-out itself, not a session to renew.
    if (endSession) await deleteSession();
    clearAuthHint();
    await quietly(async () => {
      const { auth, sdk } = await loadFirebase();
      await sdk.signOut(auth);
    });
    guest(notice);
  }

  return {
    currentUid: () => uid,
    takeNotices: (): ToastInput[] => notices.splice(0),

    async start() {
      const started = generation;
      if ((redirectPending() || isFirebaseLoaded()) && (await completeRedirect())) return;
      if (started !== generation) return;
      if (!hasAuthHint()) return guest();
      const me = await fetchMe();
      if (started !== generation) return;
      if (me.kind === 'user') return signedIn(me.user);
      if (me.kind === 'unauthenticated') return void (await renew());
      if (me.kind === 'off') clearAuthHint();
      guest();
    },

    /** From the account library on a 401: renews only while someone is signed in (a retired request is ignored). */
    onUnauthenticated: (): Promise<boolean> => (uid === null ? Promise.resolve(false) : renew()),

    signInWithGoogle: () => withSignIn(googleSignIn),
    signInWithEmail: (email: string, password: string) => withSignIn((c) => emailSignIn(c, email, password)),
    signUpWithEmail: (name: string, email: string, password: string) =>
      withSignIn(
        (c) => emailSignUp(c, name, email, password),
        (c, user) => c.sdk.sendEmailVerification(user),
      ),

    async sendVerification() {
      const { auth, sdk } = await loadFirebase();
      if (!auth.currentUser) throw new Error('No Firebase user to verify');
      await sdk.sendEmailVerification(auth.currentUser);
    },

    signOut: () => leave(true),

    /** The account was deleted (the server already cleared the cookies): forget it here, and say so once a visitor. */
    accountDeleted: (notice: string) => leave(false, notice),

    /** A new session with a recent `auth_time`, to delete the account (see `reauthenticateSession`). */
    async reauthenticate(password?: string): Promise<boolean> {
      const target = uid;
      if (target === null) throw new Error('No one is signed in');
      const result = await reauthenticateSession(await loadFirebase(), { id: target, email }, password);
      if (result && uid === target) adopt(result.user, result.sessionUser);
      return result !== null;
    },

    async refresh() {
      if (uid === null) return;
      const started = generation;
      await quietly(async () => {
        const { auth } = await loadFirebase();
        const user = auth.currentUser;
        if (!user) return;
        await user.reload();
        deps.setFirebaseVerified({ uid: user.uid, verified: user.emailVerified });
      });
      const me = await fetchMe();
      if (started !== generation || uid === null) return;
      if (me.kind === 'user') signedIn(me.user);
      else if (me.kind === 'unauthenticated') await renew();
    },
  };
}

export type AuthFlows = ReturnType<typeof createAuthFlows>;
