'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/ui/toast/useToast';
import type { LibraryRepository } from './repository';
import { createLocalRepository } from './local-repository';

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

/** Tests inject a fake repository; production uses the local one. */
export function LibraryProvider({ children, repository }: { children: ReactNode; repository?: LibraryRepository }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [current] = useState<LibraryRepository>(() => repository ?? createLocalRepository());
  const warned = useRef(false);

  useEffect(() => {
    return current.subscribe(() => {
      void queryClient.invalidateQueries({ queryKey: LIBRARY_KEY });
    });
  }, [current, queryClient]);

  useEffect(() => {
    if (current.persistent || warned.current) return;
    warned.current = true;
    toast.show({ message: 'Seu navegador está bloqueando o armazenamento. A lista vale só até fechar a aba.' });
  }, [current, toast]);

  return <RepositoryContext.Provider value={current}>{children}</RepositoryContext.Provider>;
}
