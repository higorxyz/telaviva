import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { AuthApi } from './auth-context';

/**
 * Stand-ins for the sign-in page's dependencies. Wire them in a test file with:
 *   vi.mock('next/navigation', async () => (await import('./test-signin')).navigationModule);
 *   vi.mock('./firebase-client', async () => (await import('./test-signin')).firebaseClientModule);
 *   vi.mock('./useAuth', async () => (await import('./test-signin')).useAuthModule);
 */

export const nav = { replace: vi.fn(), search: '' };
export const preload = vi.fn();
export const auth: { current: AuthApi } = { current: null as unknown as AuthApi };

export const navigationModule = {
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
};
export const firebaseClientModule = { preloadFirebase: preload };
export const useAuthModule = { useAuth: () => auth.current };

export function resetSignIn() {
  nav.replace.mockReset();
  nav.search = '';
  preload.mockReset();
  window.sessionStorage.clear();
  auth.current = {
    status: 'guest',
    user: null,
    signInWithGoogle: vi.fn(async () => {}),
    signInWithEmail: vi.fn(async () => {}),
    signUpWithEmail: vi.fn(async () => {}),
    sendVerification: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    refresh: vi.fn(async () => {}),
    reauthenticate: vi.fn(async () => 'renewed' as const),
    accountDeleted: vi.fn(async () => {}),
  };
}

export function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export const tab = (name: string) => screen.getByRole('tab', { name });

export async function fill(email: string, password: string) {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('E-mail'), email);
  await u.type(screen.getByLabelText('Senha'), password);
  return u;
}
