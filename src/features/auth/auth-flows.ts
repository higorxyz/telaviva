import type { User } from 'firebase/auth';
import type { ToastInput } from '@/ui/toast/useToast';
import type { AuthStatus } from './auth-context';
import { authErrorMessage, endsSession } from './errors';
import { isFirebaseLoaded, loadFirebase, type FirebaseClient } from './firebase-client';
import { clearAuthHint, createSession, deleteSession, fetchMe, hasAuthHint, type SessionUser } from './session-client';
import { reauthFirebase } from './reauth';
import { readRedirectReturn } from './redirect-return';
import { emailSignIn, emailSignUp, googleSignIn, redirectPending } from './sign-in';

export const SESSION_EXPIRED = 'Sua sessão expirou. Entre de novo para sincronizar.';

/** `renewed`: a recent session now; `leaving`: off to the Google redirect; `aborted`: the identity here changed. */
export type ReauthOutcome = 'renewed' | 'leaving' | 'aborted';

export type AuthSnapshot = { status: AuthStatus; user: SessionUser | null };

type Deps = {
  setSnapshot(snapshot: AuthSnapshot): void;
  setFirebaseVerified(value: { uid: string; verified: boolean }): void;
  /** A toast is waiting in `takeNotices()`: the provider shows it once the state change it goes with is committed. */
  onNotice(): void;
};

/** The confirmation e-mail links back to the account page of this very site (preview or production). */
const verificationSettings = () => ({ url: `${window.location.origin}/conta` });

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
  /** What the session cookie says about the e-mail (frozen when the session was minted). */
  let sessionVerified = false;
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
    sessionVerified = user.emailVerified;
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

  /** True when it minted a session that says the e-mail is confirmed (see `refresh`). */
  async function remintVerified(user: User | null, started: number): Promise<boolean> {
    if (!user?.emailVerified || user.uid !== uid || sessionVerified) return false;
    try {
      const sessionUser = await createSession(await user.getIdToken(true));
      if (started !== generation || sessionUser.id !== uid) return false;
      adopt(user, sessionUser);
      return true;
    } catch {
      return false; // The old cookie still works; the next refresh tries again.
    }
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
    if (message) notify({ message, tone: 'error' });
    return false;
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

  const flows = {
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
      const target = uid;
      if (target === null) throw new Error('No one is signed in');
      const user = await reauthFirebase(await loadFirebase(), { id: target, email }, password);
      if (!user) return 'leaving';
      if (uid !== target) return 'aborted';
      const sessionUser = await createSession(await user.getIdToken(true));
      if (uid !== target || sessionUser.id !== target) {
        await quietly(() => flows.refresh());
        return 'aborted';
      }
      adopt(user, sessionUser);
      return 'renewed';
    },

    /**
     * Reloads the Firebase user and the session user. Once Firebase says the e-mail is confirmed but the session
     * cookie (which froze `email_verified` when it was minted) does not, it mints a fresh session from a new ID token
     * (its fresh `iat` is accepted), so the next full load does not flash the verification banner again.
     */
    async refresh() {
      if (uid === null) return;
      const started = generation;
      let reloaded: User | null = null;
      await quietly(async () => {
        const { auth } = await loadFirebase();
        const user = auth.currentUser;
        if (!user) return;
        await user.reload();
        deps.setFirebaseVerified({ uid: user.uid, verified: user.emailVerified });
        reloaded = user;
      });
      if (started !== generation || uid === null) return;
      if (await remintVerified(reloaded, started)) return;
      const me = await fetchMe();
      if (started !== generation || uid === null) return;
      if (me.kind === 'user') signedIn(me.user);
      else if (me.kind === 'unauthenticated') await renew();
    },
  };
  return flows;
}

export type AuthFlows = ReturnType<typeof createAuthFlows>;
