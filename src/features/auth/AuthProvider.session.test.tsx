import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '@/features/library/commands';
import { useLibraryActions } from '@/features/library/hooks';
import { NOW, want } from '@/features/library/test-storage';
import { EMPTY_LIBRARY } from '@/features/library/types';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { useAuthLibraryBinding } from './auth-context';
import { AuthProvider } from './AuthProvider';
import { resetFirebaseClient } from './firebase-client';
import { authConfig, fakeAuth, fakeUser, log, resetFakeFirebase, sdk } from './test-firebase';
import {
  accounts,
  auth as authHolder,
  clearCookies,
  EXPIRED,
  hasHint,
  installDefaultApi,
  probe,
  renderAuth,
  setHint,
  signedInOnServer,
  url,
} from './test-auth';
import { useAuth } from './useAuth';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

beforeEach(() => {
  resetFakeFirebase();
  resetFirebaseClient();
  authConfig.enabled = true;
  installDefaultApi();
});
afterEach(() => {
  clearCookies();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('AuthProvider: start and session renewal', () => {
  it('renders loading on the server, even with the tv_auth cookie', () => {
    setHint();
    function Status() {
      return <span>{useAuth().status}</span>;
    }
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <AuthProvider>
            <Status />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(html).toContain('loading');
  });

  it('is disabled without the Firebase config, and downloads nothing', async () => {
    authConfig.enabled = false;
    setHint();
    renderAuth();
    expect(probe()).toMatch(/^disabled\|-/);
    await act(async () => {});
    expect(log).toEqual([]);
    expect(sdk.initializeAuth).not.toHaveBeenCalled();
  });

  it('is a guest without tv_auth: no request and no Firebase', async () => {
    renderAuth();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(log).toEqual([]);
    expect(sdk.initializeAuth).not.toHaveBeenCalled();
  });

  it('signs in from tv_auth when me answers 200, using the account library', async () => {
    accounts.set('u1', applyCommand(EMPTY_LIBRARY, want(3), NOW));
    signedInOnServer('u1');
    renderAuth();
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    expect(sdk.initializeAuth).not.toHaveBeenCalled();
  });

  it('renews the session in silence on a 401 when Firebase still has the user', async () => {
    setHint();
    fakeAuth.currentUser = fakeUser('u1');
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u1/));
    expect(log.slice(0, 3)).toEqual(['GET me', 'getIdToken:true', 'POST session:token-u1']);
    expect(screen.queryByText(EXPIRED)).toBeNull();
  });

  it('turns guest with the expired toast on a 401 without a Firebase user', async () => {
    setHint();
    renderAuth();
    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    expect(probe()).toMatch(/^guest\|-/);
    expect(hasHint()).toBe(false);
    await waitFor(() => expect(log).toContain('DELETE session'));
  });

  it('turns guest with the toast, and signs Firebase out, when the renewal is refused', async () => {
    setHint();
    fakeAuth.currentUser = fakeUser('u1');
    server.use(http.post(url('/api/auth/session'), () => HttpResponse.json({ error: 'stale_login' }, { status: 401 })));
    renderAuth();
    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    expect(probe()).toMatch(/^guest/);
    expect(log).toContain('signOut');
  });

  it('turns guest in silence when sign-in is off on the server (me 404)', async () => {
    setHint();
    server.use(http.get(url('/api/auth/me'), () => HttpResponse.json({ error: 'not_found' }, { status: 404 })));
    renderAuth();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(hasHint()).toBe(false);
    expect(screen.queryByText(EXPIRED)).toBeNull();
  });

  it('keeps the expired toast through the switch from account to guest', async () => {
    signedInOnServer('u1');
    server.use(http.get(url('/api/library'), () => HttpResponse.json({ error: 'unauthenticated' }, { status: 401 })));
    renderAuth();
    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(screen.getByText(EXPIRED)).toBeInTheDocument();
  });

  it('shares one renewal between concurrent onUnauthenticated calls', async () => {
    signedInOnServer('u1');
    fakeAuth.currentUser = fakeUser('u1');
    const results: Promise<boolean | void>[] = [];
    function Twice() {
      const { onUnauthenticated } = useAuthLibraryBinding();
      return <button onClick={() => results.push(onUnauthenticated(), onUnauthenticated())}>duas</button>;
    }
    renderAuth(<Twice />);
    await waitFor(() => expect(probe()).toMatch(/^signed-in/));
    fireEvent.click(screen.getByText('duas'));
    expect(results[0]).toBe(results[1]);
    expect(await results[0]).toBe(true);
    expect(log.filter((entry) => entry.startsWith('POST session'))).toHaveLength(1);
  });

  it('retries the action after a silent renewal, with no error toast', async () => {
    signedInOnServer('u1');
    fakeAuth.currentUser = fakeUser('u1');
    let calls = 0;
    server.use(
      http.post(url('/api/library/commands'), () => {
        calls++;
        if (calls === 1) return HttpResponse.json({ error: 'unauthenticated' }, { status: 401 });
        const saved = applyCommand(EMPTY_LIBRARY, want(1), NOW);
        accounts.set('u1', saved);
        return HttpResponse.json(saved);
      }),
    );
    function Save() {
      const { run } = useLibraryActions();
      return <button onClick={() => run(want(1))}>salvar</button>;
    }
    renderAuth(<Save />);
    await waitFor(() => expect(probe()).toBe('signed-in|u1|0'));
    fireEvent.click(screen.getByText('salvar'));
    await waitFor(() => expect(calls).toBe(2));
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    expect(screen.queryByText(/Não foi possível/)).toBeNull();
    expect(screen.queryByText(EXPIRED)).toBeNull();
  });

  it('prefers the Firebase emailVerified, and refresh() reloads the Firebase user', async () => {
    signedInOnServer('u1', { emailVerified: false });
    const user = fakeUser('u1');
    fakeAuth.currentUser = user;
    renderAuth();
    await waitFor(() => expect(probe()).toMatch(/^signed-in/));
    expect(auth().user?.emailVerified).toBe(false);
    user.reload.mockImplementation(async () => {
      user.emailVerified = true;
    });
    await act(async () => auth().refresh());
    expect(user.reload).toHaveBeenCalled();
    await waitFor(() => expect(auth().user?.emailVerified).toBe(true));
  });
});

const auth = () => authHolder.current!;
