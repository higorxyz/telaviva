'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/ui/toast/useToast';
import { NOTICE } from './copy';
import type { LibraryNotice, LibraryRepository } from './repository';
import { createLocalRepository } from './local-repository';
import { createServerRepository } from './server-repository';

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

export type LibraryMode = { kind: 'guest' } | { kind: 'account'; uid: string };

const IdentityContext = createContext('guest');

/** `'guest'` or the signed-in uid; views key themselves by it so per-identity state starts over. */
export function useLibraryIdentity(): string {
  return useContext(IdentityContext);
}

const identityOf = (mode: LibraryMode) => (mode.kind === 'account' ? mode.uid : 'guest');

/** Data of one identity must never show up in the other. */
const IDENTITY_QUERIES = [['library'], ['recommendations'], ['tv-progress']] as const;

const NOTICE_REPEAT_MS = 2000;
const noop = () => {};

/** A stable function that always calls the latest `fn`, so it can be handed to a repository that is not rebuilt. */
function useLatestCallback(fn: () => void): () => void {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  }, [fn]);
  return useCallback(() => ref.current(), []);
}

/**
 * Guests use the browser repository, signed-in users the server one; it is rebuilt when `mode` changes.
 * Tests inject a fake `repository`, which always wins.
 */
export function LibraryProvider({
  children,
  repository,
  mode = { kind: 'guest' },
  onUnauthenticated = noop,
}: {
  children: ReactNode;
  repository?: LibraryRepository;
  mode?: LibraryMode;
  onUnauthenticated?: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const identity = identityOf(mode);
  const handleUnauthenticated = useLatestCallback(onUnauthenticated);

  const build = (): LibraryRepository =>
    repository ??
    (mode.kind === 'account'
      ? createServerRepository({ onUnauthenticated: handleUnauthenticated })
      : createLocalRepository());
  const [built, setBuilt] = useState(() => ({ identity, repository: build() }));
  let current = built.repository;
  if (built.identity !== identity) {
    // Derived state: rebuilt during render, before any child reads the cache, and the old identity's data is dropped.
    for (const queryKey of IDENTITY_QUERIES) queryClient.removeQueries({ queryKey });
    current = build();
    setBuilt({ identity, repository: current });
  }
  const warned = useRef(false);
  const recovered = useRef(false);
  const lastShown = useRef(new Map<LibraryNotice, number>());

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
