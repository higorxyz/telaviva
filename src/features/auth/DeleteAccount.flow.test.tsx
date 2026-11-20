import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { item, KEY } from '@/features/library/test-storage';
import { resetFirebaseClient } from './firebase-client';
import { preMergeKey } from './merge-on-login';
import { REDIRECT_FLAG } from './sign-in';
import {
  confirmButton,
  DELETED,
  deleteAnswers,
  nav,
  openAndType,
  polyfillDialog,
  REAUTH,
  renderSignedIn,
} from './test-account';
import { clearCookies, hasHint, installDefaultApi, probe } from './test-auth';
import { authConfig, authError, fakeAuth, fakeUser, log, resetFakeFirebase, sdk } from './test-firebase';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);
vi.mock('next/navigation', async () => (await import('./test-nav')).navigationModule);

beforeAll(polyfillDialog);
beforeEach(() => {
  resetFakeFirebase();
  resetFirebaseClient();
  authConfig.enabled = true;
  installDefaultApi();
  nav.replace.mockReset();
  nav.push.mockReset();
});
afterEach(() => {
  clearCookies();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

const guestRaw = JSON.stringify({ version: 1, items: [item(1)], episodes: [], ratings: [] });
const MERGED_KEY = 'telaviva:library:v1:merged:u1';
const REAUTH_ERROR = { status: 401, body: { error: 'reauth' } };

describe('DeleteAccount: after the account is deleted', () => {
  it('clears this device, signs Firebase out, becomes a visitor, goes home and says so', async () => {
    window.localStorage.setItem(KEY, guestRaw);
    window.localStorage.setItem(preMergeKey('u1'), guestRaw);
    window.localStorage.setItem(MERGED_KEY, '1:abc');
    window.sessionStorage.setItem(MERGED_KEY, '1:abc');
    window.localStorage.setItem(preMergeKey('someone-else'), guestRaw);
    deleteAnswers({ status: 204 });
    await renderSignedIn();
    const user = await openAndType();
    await user.click(confirmButton());

    expect(await screen.findByText(DELETED)).toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith('/');
    // The visitor's library is empty: neither the local copy nor its backups came back.
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(preMergeKey('u1'))).toBeNull();
    expect(window.localStorage.getItem(MERGED_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(MERGED_KEY)).toBeNull();
    expect(window.localStorage.getItem(preMergeKey('someone-else'))).toBe(guestRaw);
    expect(log).toContain('signOut');
    expect(hasHint()).toBe(false);
    // Shown after the switch to the visitor, so closing the old identity's toasts did not take it.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.getByText(DELETED)).toBeInTheDocument();
  });
});

describe('DeleteAccount: signing in again when the sign-in is not recent', () => {
  it('Google: re-authenticates the same user, mints a new session, then deletes', async () => {
    deleteAnswers(REAUTH_ERROR, { status: 204 });
    await renderSignedIn({ provider: 'google' });
    const user = await openAndType();
    await user.click(confirmButton());
    expect(await screen.findByText(REAUTH)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continuar com Google' }));

    expect(await screen.findByText(DELETED)).toBeInTheDocument();
    const steps = log.filter((e) => /DELETE account|reauthenticate|getIdToken|POST session/.test(e));
    expect(steps).toEqual([
      'DELETE account',
      'reauthenticateWithPopup:u1',
      'getIdToken:true',
      'POST session:token-u1',
      'DELETE account',
    ]);
  });

  it('password: asks for it, re-authenticates with it, mints a new session, then deletes', async () => {
    deleteAnswers(REAUTH_ERROR, { status: 204 });
    await renderSignedIn({ provider: 'password' });
    const user = await openAndType();
    await user.click(confirmButton());
    expect(await screen.findByText(REAUTH)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Senha'), 'segredo123');
    await user.click(screen.getByRole('button', { name: 'Entrar de novo' }));

    expect(await screen.findByText(DELETED)).toBeInTheDocument();
    expect(sdk.reauthenticateWithCredential).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1' }), {
      email: 'u1@exemplo.com',
      password: 'segredo123',
    });
    expect(log.filter((e) => e === 'DELETE account' || e.startsWith('POST session'))).toEqual([
      'DELETE account',
      'POST session:token-u1',
      'DELETE account',
    ]);
  });

  it('a wrong password shows the sign-in error and deletes nothing', async () => {
    deleteAnswers(REAUTH_ERROR);
    sdk.reauthenticateWithCredential.mockRejectedValueOnce(authError('auth/wrong-password'));
    await renderSignedIn({ provider: 'password' });
    const user = await openAndType();
    await user.click(confirmButton());
    await user.type(await screen.findByLabelText('Senha'), 'errada123');
    await user.click(screen.getByRole('button', { name: 'Entrar de novo' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    expect(log.filter((e) => e === 'DELETE account')).toHaveLength(1);
  });

  it('without a Firebase user here, accepts a fresh sign-in only as the same person', async () => {
    deleteAnswers(REAUTH_ERROR, { status: 204 });
    sdk.signInWithPopup.mockImplementationOnce(async () => {
      fakeAuth.currentUser = fakeUser('u2');
      return { user: fakeAuth.currentUser };
    });
    await renderSignedIn({ provider: 'google' }, { firebaseUser: false });
    const user = await openAndType();
    await user.click(confirmButton());
    await user.click(await screen.findByRole('button', { name: 'Continuar com Google' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Entre com a mesma conta que você quer excluir.');
    expect(log.filter((e) => e === 'DELETE account')).toHaveLength(1);
    expect(log.some((e) => e.startsWith('POST session'))).toBe(false);
    expect(log).toContain('signOut');
    expect(probe()).toMatch(/^signed-in\|u1/);
  });

  it('when the popup cannot open, leaves for the Google redirect without deleting', async () => {
    deleteAnswers(REAUTH_ERROR, { status: 204 });
    sdk.reauthenticateWithPopup.mockRejectedValueOnce(authError('auth/popup-blocked'));
    await renderSignedIn({ provider: 'google' });
    const user = await openAndType();
    await user.click(confirmButton());
    await user.click(await screen.findByRole('button', { name: 'Continuar com Google' }));

    await waitFor(() => expect(log).toContain('reauthenticateWithRedirect:u1'));
    expect(window.sessionStorage.getItem(REDIRECT_FLAG)).toBe('1');
    expect(log.filter((e) => e === 'DELETE account')).toHaveLength(1);
  });

  it('a session that was signed out elsewhere (401) also asks to sign in again', async () => {
    deleteAnswers({ status: 401, body: { error: 'unauthenticated' } }, { status: 204 });
    await renderSignedIn({ provider: 'google' });
    const user = await openAndType();
    await user.click(confirmButton());
    expect(await screen.findByText(REAUTH)).toBeInTheDocument();
  });
});
