import { act, screen, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { Activity, useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFirebaseClient } from './firebase-client';
import {
  confirmButton,
  deleteAnswers,
  expectedUsers,
  nav,
  openAndType,
  polyfillDialog,
  pressEscape,
  pressEscapeWithLateClose,
  renderSignedIn,
  STALE,
} from './test-account';
import { clearCookies, installDefaultApi, probe, renderAuth, signedInOnServer } from './test-auth';
import { DeleteAccount } from './DeleteAccount';
import { authConfig, log, resetFakeFirebase } from './test-firebase';

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

const dialog = () => screen.getByRole('dialog', { name: 'Excluir minha conta' }) as HTMLDialogElement;
const deleteCalls = () => log.filter((entry) => entry === 'DELETE account').length;

describe('DeleteAccount: the confirmation dialog', () => {
  it('opens as a modal with the fixed text, focus in "Digite EXCLUIR"', async () => {
    await renderSignedIn();
    await openAndType('');
    expect(dialog()).toHaveAttribute('open');
    expect(
      screen.getByText('Isso apaga sua conta e toda a sua lista para sempre. Digite EXCLUIR para confirmar.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Digite EXCLUIR')).toHaveFocus();
    expect(dialog()).toHaveAccessibleDescription(
      'Isso apaga sua conta e toda a sua lista para sempre. Digite EXCLUIR para confirmar.',
    );
  });

  it('enables "Excluir para sempre" only for EXCLUIR exactly (case-sensitive, trimmed)', async () => {
    deleteAnswers({ status: 204 });
    await renderSignedIn();
    const user = await openAndType('excluir');
    expect(confirmButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(confirmButton());
    expect(deleteCalls()).toBe(0);

    await user.clear(screen.getByLabelText('Digite EXCLUIR'));
    await user.type(screen.getByLabelText('Digite EXCLUIR'), 'EXCLUI');
    expect(confirmButton()).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByLabelText('Digite EXCLUIR'), 'R ');
    expect(confirmButton()).not.toHaveAttribute('aria-disabled');
  });

  it('closes on Esc and on "Cancelar", giving focus back to the trigger', async () => {
    await renderSignedIn();
    const user = await openAndType('');
    act(() => {
      expect(pressEscape(dialog())).toBe(false);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toHaveFocus();
  });

  it('opens again when pressed before the close event of an Esc arrives (busy main thread)', async () => {
    await renderSignedIn();
    const user = await openAndType('EXC');
    const trigger = screen.getByRole('button', { name: 'Excluir minha conta' });
    let deliverClose!: () => void;
    act(() => {
      deliverClose = pressEscapeWithLateClose(dialog());
    });
    trigger.focus();
    await user.click(trigger);
    act(() => deliverClose());
    expect(dialog()).toHaveAttribute('open');
    expect(screen.getByLabelText('Digite EXCLUIR')).toHaveFocus();
    expect(screen.getByLabelText('Digite EXCLUIR')).toHaveValue('');
  });

  it('starts over each time it opens', async () => {
    await renderSignedIn();
    const user = await openAndType('EXCLUIR');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    expect(screen.getByLabelText('Digite EXCLUIR')).toHaveValue('');
  });

  it('closes when /conta is hidden in an Activity (browser Back), so the page behind is never left inert', async () => {
    function Route() {
      const [mode, setMode] = useState<'visible' | 'hidden'>('visible');
      return (
        <>
          <button onClick={() => setMode((m) => (m === 'visible' ? 'hidden' : 'visible'))}>trocar rota</button>
          <Activity mode={mode}>
            <DeleteAccount />
          </Activity>
        </>
      );
    }
    signedInOnServer('u1');
    renderAuth(<Route />);
    await waitFor(() => expect(probe()).toMatch(/^signed-in/));
    const user = await openAndType('EXC');
    expect(dialog()).toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'trocar rota' }));
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');

    await user.click(screen.getByRole('button', { name: 'trocar rota' }));
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
    await user.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    expect(screen.getByLabelText('Digite EXCLUIR')).toHaveValue('');
  });
});

describe('DeleteAccount: while deleting and on errors', () => {
  it('is busy while the request runs: Esc and "Cancelar" do nothing', async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    deleteAnswers(async () => {
      await held;
      return HttpResponse.json({ error: 'server_error' }, { status: 502 });
    });
    await renderSignedIn();
    const user = await openAndType();
    await user.click(confirmButton());
    await waitFor(() => expect(dialog()).toHaveAttribute('aria-busy', 'true'));
    expect(confirmButton()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveAttribute('aria-disabled', 'true');
    act(() => {
      expect(pressEscape(dialog())).toBe(true);
    });
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(dialog()).toHaveAttribute('open');

    await act(async () => release());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível excluir sua conta agora. Tente de novo.',
    );
    expect(dialog()).not.toHaveAttribute('aria-busy');
  });

  it('shows a failure (502) in the dialog and lets the person try again', async () => {
    deleteAnswers({ status: 502, body: { error: 'server_error' } }, { status: 204 });
    await renderSignedIn();
    const user = await openAndType();
    await user.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível excluir sua conta agora. Tente de novo.',
    );
    expect(dialog()).toHaveAttribute('open');
    expect(probe()).toMatch(/^signed-in\|u1/);

    await user.click(confirmButton());
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'));
    expect(deleteCalls()).toBe(2);
  });

  it('names the account the dialog was opened for, so the server can refuse another one', async () => {
    deleteAnswers({ status: 204 });
    await renderSignedIn();
    const user = await openAndType();
    await user.click(confirmButton());
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'));
    expect(expectedUsers).toEqual(['u1']);
  });

  it('409 (another tab switched accounts): deletes nothing, says so, and shows the account now open', async () => {
    deleteAnswers({ status: 409, body: { error: 'wrong_account' } });
    await renderSignedIn();
    const user = await openAndType();
    signedInOnServer('u2'); // Another tab signed in as u2: the cookie is now theirs.
    await user.click(confirmButton());
    expect(await screen.findByText(STALE)).toBeInTheDocument();
    await waitFor(() => expect(probe()).toMatch(/^signed-in\|u2/));
    expect(nav.replace).not.toHaveBeenCalled();
    expect(deleteCalls()).toBe(1);
  });

  it('says so when offline', async () => {
    deleteAnswers(async () => HttpResponse.error());
    await renderSignedIn();
    const user = await openAndType();
    await user.click(confirmButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão. Verifique sua internet.');
  });
});
