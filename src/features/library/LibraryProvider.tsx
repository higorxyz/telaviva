'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/ui/toast/useToast';
import { NOTICE } from './copy';
import { createFor, isRetired, setRetired, type LibraryMode } from './mode-repository';
import { reloadQuery } from './reload-query';
import type { LibraryNotice, LibraryRepository } from './repository';
import type { OnUnauthenticated } from './server-repository';

export { isRetired, type LibraryMode };

export const LIBRARY_KEY = ['library'] as const;

/**
 * The library's queries and writes run whatever TanStack Query believes about the connection: the repository is what
 * works offline (the visitor's list is on the device; the account's falls back to its saved copy and queues actions).
 * With the default `online` mode, a write made after the browser said `offline` would only show its optimistic value
 * and wait, unsaved and unqueued, for the connection to return.
 *
 * Trade-off: where IndexedDB is missing (the no-store fallback, the plain server repository), an account action taken
 * offline now fails at once, with the rollback and the error toast, instead of TanStack pausing it until the
 * connection returns.
 */
export const LIBRARY_NETWORK_MODE = 'always';

const RepositoryContext = createContext<LibraryRepository | null>(null);

export function useLibraryRepository(): LibraryRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('Library hooks must be used inside LibraryProvider');
  return repository;
}

/** The repository when a LibraryProvider is above, or null; for UI that also renders without one. */
export function useOptionalLibraryRepository(): LibraryRepository | null {
  return useContext(RepositoryContext);
}

/** True when a LibraryProvider is above; lets optional UI (poster cards) render nothing without one. */
export function useHasLibrary(): boolean {
  return useOptionalLibraryRepository() !== null;
}

const IdentityContext = createContext('guest');

/** `'pending'`, `'guest'` or the signed-in uid; views key themselves by it so per-identity state starts over. */
export function useLibraryIdentity(): string {
  return useContext(IdentityContext);
}

const PENDING = 'pending';
const identityOf = (mode: LibraryMode) => (mode.kind === 'account' ? mode.uid : mode.kind);

/** Data of one identity must never show up in the other. */
const IDENTITY_QUERIES = [['library'], ['recommendations'], ['tv-progress']] as const;

/** Tag of the toasts that belong to one identity (undo actions): they are closed when the identity changes. */
export const LIBRARY_TOAST_TAG = 'library';

const NOTICE_REPEAT_MS = 2000;
const noop = () => {};

/** A stable function that always calls the latest `fn`, so it can be handed to a repository that is not rebuilt. */
function useLatestCallback<R>(fn: () => R): () => R {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  return useCallback(() => ref.current(), []);
}

type ProviderProps = {
  children: ReactNode;
  repository?: LibraryRepository;
  mode?: LibraryMode;
  /** Runs the session renewal; resolving `true` (renewed for the same user) lets the request be retried once. */
  onUnauthenticated?: OnUnauthenticated;
  /** The session turned out to be another account's (another tab switched): sign-in looks again at who is in. */
  onWrongAccount?: () => void;
};

/**
 * Guests use the browser repository, signed-in users the server one. Tests inject a fake `repository`, which
 * always wins.
 *
 * When the identity changes between two known identities, the old identity's queries and its library toasts (undo
 * actions) are removed before the new scope mounts (a layout effect plus a synchronous re-render, so nothing paints in
 * between). Other toasts, such as the sign-in ones, stay. The scope gets a new key, so every observer below it starts
 * fresh and no hook can keep serving the previous identity's data as a placeholder.
 *
 * Leaving `pending` is not such a change: pending holds no data, so the first identity takes over the same scope (the
 * page below is not remounted) and only the repository is swapped.
 */
export function LibraryProvider({ mode = { kind: 'guest' }, ...rest }: ProviderProps) {
  const queryClient = useQueryClient();
  const { dismissTag } = useToast();
  const identity = identityOf(mode);
  const [scope, setScope] = useState({ identity, key: 0 });
  const switching = scope.identity !== identity && scope.identity !== PENDING;

  useLayoutEffect(() => {
    if (scope.identity === identity) return;
    if (scope.identity !== PENDING) {
      for (const queryKey of IDENTITY_QUERIES) queryClient.removeQueries({ queryKey });
      dismissTag(LIBRARY_TOAST_TAG);
    }
    // The synchronous re-render must happen before paint, which is why this is an effect and not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScope({ identity, key: scope.identity === PENDING ? scope.key : scope.key + 1 });
  }, [scope, identity, queryClient, dismissTag]);

  if (switching) return null;
  return <IdentityScope key={scope.key} identity={identity} mode={mode} {...rest} />;
}

function IdentityScope({
  children,
  repository,
  mode = { kind: 'guest' },
  identity,
  onUnauthenticated = noop,
  onWrongAccount = noop,
}: ProviderProps & { identity: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const handleUnauthenticated = useLatestCallback(onUnauthenticated);
  const handleWrongAccount = useLatestCallback(onWrongAccount);
  const callbacks = { onUnauthenticated: handleUnauthenticated, onWrongAccount: handleWrongAccount };
  const [held, setHeld] = useState(() => ({
    identity,
    repository: repository ?? createFor(mode, callbacks),
  }));
  let current = held.repository;
  // Only on leaving `pending` (any other change remounts this scope): swap the repository, keep the tree.
  if (held.identity !== identity && !repository) {
    current = createFor(mode, callbacks);
    setHeld({ identity, repository: current });
  }
  const warned = useRef(false);
  const recovered = useRef(false);
  const lastShown = useRef(new Map<LibraryNotice, number>());

  // A mutation still running for this identity must not touch the next one (its undo toasts are closed by the
  // outer provider, on a real identity change only: StrictMode's simulated unmount must not close them).
  useEffect(() => {
    setRetired(current, false);
    return () => setRetired(current, true);
  }, [current]);

  // Sends the offline queue while this identity is on screen.
  useEffect(() => current.queue?.start(), [current]);

  useEffect(() => {
    return current.subscribe(() => {
      // A write in flight reloads the list itself when it settles; a load now could read it before the write.
      if (queryClient.isMutating({ mutationKey: LIBRARY_KEY }) > 0) return;
      // A load in flight (the first one included) may have read the list before this change: it is dropped.
      void reloadQuery(queryClient, LIBRARY_KEY);
    });
  }, [current, queryClient]);

  useEffect(() => {
    if (!current.onNotice) return;
    return current.onNotice((notice) => {
      if (notice === 'recovered') {
        if (recovered.current) return;
        recovered.current = true;
      } else {
        const now = Date.now();
        const last = lastShown.current.get(notice);
        if (last !== undefined && now - last < NOTICE_REPEAT_MS) return;
        lastShown.current.set(notice, now);
      }
      // A queue notice replaces the one already up instead of stacking (a sync may refuse several actions).
      const queued = notice === 'queueRejected' || notice === 'queueExpired';
      const tag = queued ? `${LIBRARY_TOAST_TAG}:${notice}` : undefined;
      if (tag) toast.dismissTag(tag);
      toast.show({ message: NOTICE[notice], tag });
    });
  }, [current, toast]);

  useEffect(() => {
    if (current.persistent || warned.current) return;
    warned.current = true;
    toast.show({ message: NOTICE.storageBlocked });
  }, [current, toast]);

  return (
    <IdentityContext.Provider value={identity}>
      <RepositoryContext.Provider value={current}>{children}</RepositoryContext.Provider>
    </IdentityContext.Provider>
  );
}
