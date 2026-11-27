import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '@/features/library/commands';
import { item, KEY, NOW, want } from '@/features/library/test-storage';
import { EMPTY_LIBRARY } from '@/features/library/types';
import { server } from '@/test/server';
import { resetFirebaseClient } from './firebase-client';
import {
  authConfig,
  authError,
  fakeAuth,
  fakeUser,
  log,
  resetFakeFirebase,
  sdk,
} from './test-firebase';
import {
  accounts,
  clearCookies,
  EXPIRED,
  hasHint,
  installDefaultApi,
  probe,
  renderAuth,
  sessionUser,
  setHint,
  signedInOnServer,
  url,
} from './test-auth';

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

describe('AuthProvider: resilience', () => {
  it.each([
    [
      'the session POST answers 500',
      () =>
        server.use(
          http.post(url('/api/auth/session'), () => new HttpResponse(null, { status: 500 })),
        ),
    ],
    [
      'the session POST never reaches the server',
      () => server.use(http.post(url('/api/auth/session'), () => HttpResponse.error())),
    ],
    [
      'the token refresh hits a network error',
      () => {
        fakeAuth.currentUser!.getIdToken.mockRejectedValueOnce(
          authError('auth/network-request-failed'),
        );
      },
    ],
    [
      'the SDK cannot load',
      () => {
        sdk.initializeAuth.mockImplementationOnce(() => {
          throw new Error('ChunkLoadError');
        });
      },
    ],
  ])('goes guest quietly, keeping the Firebase user and the hint, when %s', async (_name, fail) => {
    setHint();
    fakeAuth.currentUser = fakeUser('u1');
    fail();
    renderAuth();
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(screen.queryByText(EXPIRED)).toBeNull();
    expect(hasHint()).toBe(true);
    expect(fakeAuth.currentUser).not.toBeNull();
    expect(log).not.toContain('signOut');
    expect(log).not.toContain('DELETE session');
  });

  it('asks /api/auth/me again after a passing failure (503, offline) while still loading, then signs in', async () => {
    signedInOnServer('u1');
    let calls = 0;
    server.use(
      http.get(url('/api/auth/me'), () => {
        calls++;
        if (calls === 1) return HttpResponse.json({ error: 'unavailable' }, { status: 503 });
        if (calls === 2) return HttpResponse.error();
        return HttpResponse.json({ user: sessionUser('u1') });
      }),
    );
    const seen = new Set<string>();
    renderAuth();
    await waitFor(
      () => {
        seen.add(probe()?.split('|')[0] ?? '');
        expect(probe()).toMatch(/^signed-in\|u1/);
      },
      { timeout: 4000 },
    );
    expect(calls).toBe(3);
    expect(seen.has('guest')).toBe(false);
  });

  it('goes guest quietly, keeping the hint, once /api/auth/me keeps failing', async () => {
    setHint();
    let calls = 0;
    server.use(
      http.get(url('/api/auth/me'), () => {
        calls++;
        return HttpResponse.json({ error: 'unavailable' }, { status: 503 });
      }),
    );
    renderAuth();
    await waitFor(() => expect(probe()).toBe('guest|-|0'), { timeout: 4000 });
    expect(calls).toBe(3);
    expect(hasHint()).toBe(true);
    expect(screen.queryByText(EXPIRED)).toBeNull();
  });

  it('expires on a definitive Firebase answer to the token refresh', async () => {
    setHint();
    fakeAuth.currentUser = fakeUser('u1');
    fakeAuth.currentUser.getIdToken.mockRejectedValueOnce(authError('auth/user-token-expired'));
    renderAuth();
    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
    expect(log).toContain('signOut');
    expect(hasHint()).toBe(false);
  });

  it('never shows the guest list before the account list, nor remounts the page in between', async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, items: [item(1), item(2)], episodes: [], ratings: [] }),
    );
    accounts.set('u1', applyCommand(EMPTY_LIBRARY, want(3), NOW));
    signedInOnServer('u1');
    let releaseMe: () => void = () => {};
    const meGate = new Promise<void>((resolve) => (releaseMe = resolve));
    server.use(
      http.get(url('/api/auth/me'), async () => {
        await meGate;
        return HttpResponse.json({ user: sessionUser('u1') });
      }),
    );
    const seen = new Set<string>();
    const observer = new MutationObserver(() => seen.add(screen.queryByTestId('probe')?.textContent ?? ''));
    renderAuth(<input aria-label="busca" defaultValue="" />);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    fireEvent.change(screen.getByLabelText('busca'), { target: { value: 'duna' } });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
    expect(probe()).toBe('loading|-|…');
    releaseMe();
    // The account list (1), then the account with the guest list merged in (3); never the guest list on its own.
    await waitFor(() => expect(probe()).toBe('signed-in|u1|3'));
    observer.disconnect();
    expect([...seen].filter((text) => !text.startsWith('signed-in') && !text.endsWith('…'))).toEqual([]);
    expect(screen.getByLabelText('busca')).toHaveValue('duna');
  });
});
