'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/ui/toast/useToast';
import { NOTICE } from './copy';
import type { LibraryNotice, LibraryRepository } from './repository';
import { createLocalRepository } from './local-repository';
import { createPendingRepository } from './pending-repository';
import { createServerRepository, type OnUnauthenticated } from './server-repository';

export const LIBRARY_KEY = ['library'] as const;

const RepositoryContext = createContext<LibraryRepository | null>(null);

export function useLibraryRepository(): LibraryRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error('Library hooks must be used inside LibraryProvider');
  return repository;
}

/** True when a LibraryProvider is above; lets optional UI (poster cards) render nothing without one. */
export function useHasLibrary(): boolean {
  return useContext(RepositoryContext) !== null;
}

/** `pending`: sign-in is still resolving; nothing loads and actions do nothing until an identity is known. */
export type LibraryMode = { kind: 'pending' } | { kind: 'guest' } | { kind: 'account'; uid: string };

const IdentityContext = createContext('guest');

/** `'pending'`, `'guest'` or the signed-in uid; views key themselves by it so per-identity state starts over. */
export function useLibraryIdentity(): string {
  return useContext(IdentityContext);
}

const PENDING = 'pending';
const identityOf = (mode: LibraryMode) => (mode.kind === 'account' ? mode.uid : mode.kind);

/** Data of one identity must never show up in the other. */
const IDENTITY_QUERIES = [['library'], ['recommendations'], ['tv-progress']] as const;

const retired = new WeakSet<LibraryRepository>();

/**
 * True once the identity that owned `repository` is gone. A mutation started under it may still settle, and
 * its callbacks must then touch neither the new identity's cache nor its toasts.
 */
export function isRetired(repository: LibraryRepository): boolean {
  return retired.has(repository);
}

/** The repository of every identity mode; the account one ignores a 401 once its identity is gone. */
function createFor(mode: LibraryMode, onUnauthenticated: OnUnauthenticated): LibraryRepository {
  if (mode.kind === 'pending') return createPendingRepository();
  if (mode.kind === 'guest') return createLocalRepository();
  const repository = createServerRepository({
    onUnauthenticated: () => (retired.has(repository) ? Promise.resolve(false) : onUnauthenticated()),
  });
  return repository;
}

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
}: ProviderProps & { identity: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const handleUnauthenticated = useLatestCallback(onUnauthenticated);
  const [held, setHeld] = useState(() => ({
    identity,
    repository: repository ?? createFor(mode, handleUnauthenticated),
  }));
  let current = held.repository;
  // Only on leaving `pending` (any other change remounts this scope): swap the repository, keep the tree.
  if (held.identity !== identity && !repository) {
    current = createFor(mode, handleUnauthenticated);
    setHeld({ identity, repository: current });
  }
  const warned = useRef(false);
  const recovered = useRef(false);
  const lastShown = useRef(new Map<LibraryNotice, number>());

  // A mutation still running for this identity must not touch the next one (its undo toasts are closed by the
  // outer provider, on a real identity change only: StrictMode's simulated unmount must not close them).
  useEffect(() => {
    retired.delete(current);
    return () => {
      retired.add(current);
    };
  }, [current]);

  useEffect(() => {
    return current.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
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
      toast.show({ message: NOTICE[notice] });
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
