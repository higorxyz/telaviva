'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LIBRARY_KEY, type LibraryMode } from '@/features/library/LibraryProvider';
import { authEnabled } from '@/lib/auth-config';
import { useToast } from '@/ui/toast/useToast';
import { AuthContext, LibraryBindingContext, type AuthApi, type LibraryBinding } from './auth-context';
import { createAuthFlows, type AuthSnapshot } from './auth-flows';
import { mergeOnLogin } from './merge-on-login';

export const LIST_SAVED = 'Sua lista foi salva na sua conta.';

const GUEST: LibraryMode = { kind: 'guest' };
const PENDING: LibraryMode = { kind: 'pending' };

/**
 * Optional sign-in (plan, Task 7). It must sit outside the library: an identity change remounts everything below
 * the library, while this state, the sign-in flows and the guest merge keep running here.
 *
 * - With sign-in off (`authEnabled` false) it stays `disabled` and never downloads Firebase.
 * - The first render is `loading` on both sides; the `tv_auth` hint is read in an effect.
 * - Toasts that go with a state change (session expired) are shown after that change is committed, so the
 *   library's identity switch cannot close them.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(() => ({
    status: authEnabled ? 'loading' : 'disabled',
    user: null,
  }));
  const [firebaseVerified, setFirebaseVerified] = useState<{ uid: string; verified: boolean } | null>(null);
  const [noticeTick, setNoticeTick] = useState(0);
  const [flows] = useState(() =>
    createAuthFlows({ setSnapshot, setFirebaseVerified, onNotice: () => setNoticeTick((tick) => tick + 1) }),
  );

  // After the commit that carries the state change (and the library's identity switch with it).
  useEffect(() => {
    for (const input of flows.takeNotices()) toast.show(input);
  }, [noticeTick, flows, toast]);

  const started = useRef(false);
  useEffect(() => {
    // Once per provider, StrictMode's second effect run included.
    if (!authEnabled || started.current) return;
    started.current = true;
    void flows.start();
  }, [flows]);

  const uid = snapshot.status === 'signed-in' ? (snapshot.user?.id ?? null) : null;

  // Right after switching to an account (and on each start while one is signed in), fold in what the visitor saved
  // here. A failed merge keeps the local copy, so the next start tries again.
  const merging = useRef(new Set<string>());
  useEffect(() => {
    if (!uid || merging.current.has(uid)) return;
    const running = merging.current;
    running.add(uid);
    void mergeOnLogin(uid)
      .then((outcome) => {
        if (outcome === 'empty' || outcome === 'unchanged') return;
        void queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
        if (outcome === 'merged' && flows.currentUid() === uid) toast.show({ message: LIST_SAVED });
      })
      .finally(() => running.delete(uid));
  }, [uid, flows, queryClient, toast]);

  const user = useMemo(() => {
    const current = snapshot.user;
    if (!current || firebaseVerified?.uid !== current.id) return current;
    return { ...current, emailVerified: firebaseVerified.verified };
  }, [snapshot.user, firebaseVerified]);

  const api = useMemo<AuthApi>(
    () => ({
      status: snapshot.status,
      user,
      signInWithGoogle: flows.signInWithGoogle,
      signInWithEmail: flows.signInWithEmail,
      signUpWithEmail: flows.signUpWithEmail,
      sendVerification: flows.sendVerification,
      signOut: flows.signOut,
      refresh: flows.refresh,
      reauthenticate: flows.reauthenticate,
      accountDeleted: flows.accountDeleted,
    }),
    [snapshot.status, user, flows],
  );

  const binding = useMemo<LibraryBinding>(
    () => ({
      mode: uid ? { kind: 'account', uid } : snapshot.status === 'loading' ? PENDING : GUEST,
      onUnauthenticated: flows.onUnauthenticated,
    }),
    [uid, snapshot.status, flows],
  );

  return (
    <AuthContext.Provider value={api}>
      <LibraryBindingContext.Provider value={binding}>{children}</LibraryBindingContext.Provider>
    </AuthContext.Provider>
  );
}
