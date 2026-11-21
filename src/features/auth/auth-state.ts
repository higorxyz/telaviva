import type { User } from 'firebase/auth';
import type { ToastInput } from '@/ui/toast/useToast';
import type { AuthStatus } from './auth-context';
import { createSession, deleteSession, type SessionUser } from './session-client';

export type AuthSnapshot = { status: AuthStatus; user: SessionUser | null };

export type AuthDeps = {
  setSnapshot(snapshot: AuthSnapshot): void;
  setFirebaseVerified(value: { uid: string; verified: boolean }): void;
  /** A toast is waiting in `takeNotices()`: the provider shows it once the state change it goes with is committed. */
  onNotice(): void;
};

export const quietly = async (work: () => Promise<unknown>) => {
  try {
    await work();
  } catch {
    // Best effort.
  }
};

/**
 * What the sign-in flows share (auth-flows.ts and session-renewal.ts): who is signed in here, and the `generation`,
 * which changes on every explicit sign-in or sign-out, so a renewal or a start-up check that began before one drops
 * its result instead of undoing it.
 */
export function createAuthState(deps: AuthDeps) {
  const notices: ToastInput[] = [];
  /** Session mints still waiting for the server (renewal, verified re-mint, re-authentication). */
  const minting = new Set<Promise<unknown>>();
  const state = {
    uid: null as string | null,
    email: null as string | null,
    /** What the session cookie says about the e-mail (frozen when the session was minted). */
    sessionVerified: false,
    generation: 0,
    deps,

    notify(toast: ToastInput) {
      notices.push(toast);
      deps.onNotice();
    },

    takeNotices: (): ToastInput[] => notices.splice(0),

    /**
     * Mints a session from a fresh ID token of the user already signed in here (renewal, verified re-mint,
     * re-authentication). Its answer sets the cookies whenever it lands, so a sign-out that happened meanwhile would be
     * undone, and with nothing revoked the next full load would sign the person back in: `leave` waits for these, and
     * a mint that still lands after a sign-out clears the cookies again.
     */
    async mint(user: User): Promise<SessionUser> {
      const started = state.generation;
      const request = user.getIdToken(true).then(createSession);
      minting.add(request);
      try {
        const sessionUser = await request;
        if (started !== state.generation && state.uid === null) await deleteSession();
        return sessionUser;
      } finally {
        minting.delete(request);
      }
    },

    /** Resolves once every mint in flight has its answer (whatever it was). */
    mintsSettled: () => Promise.allSettled([...minting]),

    signedIn(user: SessionUser) {
      state.uid = user.id;
      state.email = user.email;
      state.sessionVerified = user.emailVerified;
      deps.setSnapshot({ status: 'signed-in', user });
    },

    /** Signed in with a session just minted from this Firebase user. */
    adopt(user: User, sessionUser: SessionUser) {
      deps.setFirebaseVerified({ uid: user.uid, verified: user.emailVerified });
      state.signedIn(sessionUser);
    },

    guest(notice?: string) {
      state.uid = null;
      state.email = null;
      deps.setSnapshot({ status: 'guest', user: null });
      if (notice) state.notify({ message: notice });
    },
  };
  return state;
}

export type AuthState = ReturnType<typeof createAuthState>;
