'use client';

import { createContext, useContext } from 'react';
import type { LibraryMode } from '@/features/library/LibraryProvider';
import type { ReauthOutcome } from './auth-flows';
import type { SessionUser } from './session-client';

export type AuthStatus = 'loading' | 'guest' | 'signed-in' | 'disabled';

export interface AuthApi {
  /** `loading` on the server and on the first client render, whatever the cookies say (hydration stays neutral). */
  status: AuthStatus;
  /** `emailVerified` comes from the Firebase user once it is loaded (the session cookie froze it at sign-in). */
  user: SessionUser | null;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(name: string, email: string, password: string): Promise<void>;
  sendVerification(): Promise<void>;
  signOut(): Promise<void>;
  /** Reloads the Firebase user and the session user (after confirming the e-mail, say). */
  refresh(): Promise<void>;
  /**
   * Signs the same user in again (Google, or e-mail with `password`) and mints a new session, so it counts as a recent
   * sign-in (required to delete the account). See `ReauthOutcome`.
   */
  reauthenticate(password?: string): Promise<ReauthOutcome>;
  /** The account was deleted: forget it on this device, become a visitor, then show `notice`. */
  accountDeleted(notice: string): Promise<void>;
}

/** What the library needs from sign-in: whose library to show, and how to renew a lost session. */
export interface LibraryBinding {
  mode: LibraryMode;
  /** Idempotent: concurrent calls share one renewal. Resolves true when renewed for the same user. */
  onUnauthenticated(): Promise<boolean>;
}

export const AuthContext = createContext<AuthApi | null>(null);
export const LibraryBindingContext = createContext<LibraryBinding | null>(null);

export function useAuthLibraryBinding(): LibraryBinding {
  const binding = useContext(LibraryBindingContext);
  if (!binding) throw new Error('useAuthLibraryBinding must be used inside AuthProvider');
  return binding;
}
