'use client';

import type { ReactNode } from 'react';
import { LibraryProvider } from '@/features/library/LibraryProvider';
import { useAuthLibraryBinding } from './auth-context';

/**
 * The library of whoever is signed in. It sits inside AuthProvider: a change of identity remounts everything below
 * it, while the sign-in state (and any sign-in still running) lives above and survives.
 */
export function AuthLibrary({ children }: { children: ReactNode }) {
  const { mode, onUnauthenticated, onWrongAccount } = useAuthLibraryBinding();
  return (
    <LibraryProvider mode={mode} onUnauthenticated={onUnauthenticated} onWrongAccount={onWrongAccount}>
      {children}
    </LibraryProvider>
  );
}
