import 'fake-indexeddb/auto';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Activity, useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '@/features/library/commands';
import { freshStore, queuedCommand } from '@/features/library/test-library-server';
import { NOW, want } from '@/features/library/test-storage';
import { EMPTY_LIBRARY } from '@/features/library/types';
import type { OfflineStore } from '@/features/offline/store-types';
import { resetFirebaseClient } from './firebase-client';
import { SignOutConfirm } from './SignOutConfirm';
import { polyfillDialog, pressEscape } from './test-account';
import { accounts, clearCookies, installDefaultApi, probe, renderAuth, signedInOnServer } from './test-auth';
import { authConfig, log, resetFakeFirebase } from './test-firebase';
import { goOffline, resetConnection } from './test-offline-auth';
import { useAuth } from './useAuth';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

const TWO = 'Você tem 2 ações não enviadas. Sair agora descarta essas ações.';
const ONE = 'Você tem 1 ação não enviada. Sair agora descarta essa ação.';

let store: OfflineStore;
beforeAll(polyfillDialog);
beforeEach(async () => {
  resetFakeFirebase();
  resetFirebaseClient();
  resetConnection();
  authConfig.enabled = true;
  installDefaultApi();
  store = await freshStore();
});
afterEach(() => {
  clearCookies();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function SignOut() {
  const { signOut } = useAuth();
  return <SignOutConfirm onSignOut={signOut} />;
}

/** Signed in as u1 with its list saved on the device, then offline with `queued` actions waiting. */
async function signedInWith(queued: number, ui = <SignOut />) {
  accounts.set('u1', applyCommand(EMPTY_LIBRARY, want(3), NOW));
  signedInOnServer('u1');
  renderAuth(ui);
  await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
  await waitFor(async () => expect(await store.getSnapshot('u1')).not.toBeNull());
  goOffline();
  for (let i = 0; i < queued; i++) await store.enqueue(queuedCommand(want(10 + i), new Date().toISOString(), 'u1'));
  return userEvent.setup();
}

const sair = () => screen.getByRole('button', { name: 'Sair' });
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;

describe('SignOutConfirm', () => {
  it('signs out at once when nothing is waiting', async () => {
    const user = await signedInWith(0);
    await user.click(sair());
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(dialog()).not.toHaveAttribute('open');
  });

  it('with 2 actions waiting asks first, with the exact text, focus on "Cancelar"', async () => {
    const user = await signedInWith(2);
    await user.click(sair());
    const opened = await screen.findByRole('dialog', { name: TWO });
    expect(opened).toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Sair mesmo assim' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(probe()).toBe('signed-in|u1|1');
  });

  it('uses the singular for one action', async () => {
    const user = await signedInWith(1);
    await user.click(sair());
    expect(await screen.findByRole('dialog', { name: ONE })).toHaveAttribute('open');
  });

  it('"Cancelar" keeps everything, and focus goes back to "Sair"', async () => {
    const user = await signedInWith(2);
    await user.click(sair());
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(dialog()).not.toHaveAttribute('open');
    expect(sair()).toHaveFocus();
    expect(probe()).toBe('signed-in|u1|1');
    expect(await store.countQueue('u1')).toBe(2);
    expect(await store.getSnapshot('u1')).not.toBeNull();
    expect(log.filter((entry) => entry.startsWith('DELETE session'))).toEqual([]);
  });

  it('Esc is "Cancelar"', async () => {
    const user = await signedInWith(2);
    await user.click(sair());
    await screen.findByRole('dialog', { name: TWO });
    expect(pressEscape(dialog())).toBe(false);
    expect(dialog()).not.toHaveAttribute('open');
    expect(sair()).toHaveFocus();
    expect(await store.countQueue('u1')).toBe(2);
  });

  it('"Sair mesmo assim" signs out and deletes the saved list and the queue', async () => {
    const user = await signedInWith(2);
    await user.click(sair());
    await user.click(await screen.findByRole('button', { name: 'Sair mesmo assim' }));
    await waitFor(() => expect(probe()).toBe('guest|-|0'));
    expect(await store.countQueue('u1')).toBe(0);
    expect(await store.getSnapshot('u1')).toBeNull();
  });

  it('closes when /conta is hidden in an Activity, so the page behind is never left inert', async () => {
    function Route() {
      const [mode, setMode] = useState<'visible' | 'hidden'>('visible');
      return (
        <>
          <button onClick={() => setMode((m) => (m === 'visible' ? 'hidden' : 'visible'))}>trocar rota</button>
          <Activity mode={mode}>
            <SignOut />
          </Activity>
        </>
      );
    }
    const user = await signedInWith(2, <Route />);
    await user.click(sair());
    await screen.findByRole('dialog', { name: TWO });
    await user.click(screen.getByRole('button', { name: 'trocar rota' }));
    expect(dialog()).not.toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'trocar rota' }));
    expect(dialog()).not.toHaveAttribute('open');
    expect(probe()).toBe('signed-in|u1|1');
  });
});
