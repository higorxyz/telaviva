import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useEffect, type ReactNode } from 'react';
import { mergeLibraries } from '@/features/library/merge';
import { EMPTY_LIBRARY, type LibraryState } from '@/features/library/types';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { useLibrary } from '@/features/library/hooks';
import { AuthLibrary } from './AuthLibrary';
import { AuthProvider } from './AuthProvider';
import type { AuthApi } from './auth-context';
import type { SessionUser } from './session-client';
import { log } from './test-firebase';
import { useAuth } from './useAuth';

export const url = (path: string) => `${window.location.origin}${path}`;

export const sessionUser = (id: string, overrides: Partial<SessionUser> = {}): SessionUser => ({
  id,
  email: `${id}@exemplo.com`,
  name: null,
  photoUrl: null,
  emailVerified: false,
  authTime: 1_700_000_000,
  ...overrides,
});

export const setHint = () => {
  document.cookie = 'tv_auth=1; Path=/';
};
export const clearCookies = () => {
  document.cookie = 'tv_auth=; Max-Age=0; Path=/';
};
export const hasHint = () => document.cookie.split(';').some((p) => p.trim() === 'tv_auth=1');

export const EXPIRED = 'Sua sessão expirou. Entre de novo para sincronizar.';
export const MERGED = 'Sua lista foi salva na sua conta.';

/** The account library each uid has on the "server", folded by merges. */
export const accounts = new Map<string, LibraryState>();
let current: string | null = null;

/**
 * Default API: `me` 401, the session minted from `token-<uid>`, the library and merge answering the account of the
 * last minted session. Every request is logged into `log`, next to the Firebase calls.
 */
export function installDefaultApi() {
  accounts.clear();
  current = null;
  server.use(
    http.get(url('/api/auth/me'), () => {
      log.push('GET me');
      return HttpResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }),
    http.post(url('/api/auth/session'), async ({ request }) => {
      const { idToken } = (await request.json()) as { idToken: string };
      log.push(`POST session:${idToken}`);
      current = idToken.replace('token-', '');
      return HttpResponse.json({ user: sessionUser(current) });
    }),
    http.delete(url('/api/auth/session'), () => {
      log.push('DELETE session');
      current = null;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(url('/api/library'), () => {
      log.push('GET library');
      return HttpResponse.json(accounts.get(current ?? '') ?? EMPTY_LIBRARY);
    }),
    http.post(url('/api/library/merge'), async ({ request }) => {
      log.push('POST merge');
      const { library } = (await request.json()) as { library: LibraryState };
      const merged = mergeLibraries(accounts.get(current ?? '') ?? EMPTY_LIBRARY, library);
      accounts.set(current ?? '', merged);
      return HttpResponse.json(merged);
    }),
  );
}

/** Pretends the server already holds a session for `uid` (as `me` 200 would say). */
export function signedInOnServer(uid: string, overrides: Partial<SessionUser> = {}) {
  current = uid;
  setHint();
  server.use(
    http.get(url('/api/auth/me'), () => {
      log.push('GET me');
      return HttpResponse.json({ user: sessionUser(uid, overrides) });
    }),
  );
}

export const auth: { current: AuthApi | null } = { current: null };

function Probe() {
  const value = useAuth();
  const { state, ready } = useLibrary();
  useEffect(() => {
    auth.current = value;
  });
  return (
    <p data-testid="probe">
      {value.status}|{value.user?.id ?? '-'}|{ready ? state?.items.length : '…'}
    </p>
  );
}

export function renderAuth(extra?: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AuthProvider>
          <AuthLibrary>
            <Probe />
            {extra}
          </AuthLibrary>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { client, ...view };
}

/** `status|uid|library size` as the probe shows it. */
export const probe = () => screen.getByTestId('probe').textContent;
