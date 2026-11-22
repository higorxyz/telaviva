import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOffline, setOffline } from '@/features/offline/test-offline';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { sessionUser } from './test-auth';
import { polyfillDialog } from './test-account';
import { auth, resetSignIn } from './test-signin';

vi.mock('next/offline', async () => (await import('@/features/offline/test-offline')).offlineModule);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/conta',
}));
vi.mock('./useAuth', async () => (await import('./test-signin')).useAuthModule);

import { AccountView } from './AccountView';

const NEEDS_NETWORK = 'Você precisa de internet para isso.';
const fetchSpy = vi.fn();

beforeAll(polyfillDialog);
beforeEach(() => {
  resetSignIn();
  resetOffline();
  fetchSpy.mockReset();
  vi.stubGlobal('fetch', fetchSpy);
  auth.current = {
    ...auth.current,
    status: 'signed-in',
    user: sessionUser('u1', {
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      emailVerified: false,
      provider: 'password',
    }),
  };
});
afterEach(() => vi.unstubAllGlobals());

function show() {
  render(
    <ToastProvider>
      <AccountView />
    </ToastProvider>,
  );
  setOffline(true);
  return userEvent.setup();
}

describe('AccountView offline', () => {
  it('"Exportar meus dados" says it needs the internet and never calls the API', async () => {
    const u = show();
    await u.click(screen.getByRole('button', { name: 'Exportar meus dados' }));
    expect(await screen.findByText(NEEDS_NETWORK)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('"Reenviar e-mail" says it needs the internet and never asks Firebase', async () => {
    const u = show();
    await u.click(screen.getByRole('button', { name: 'Reenviar e-mail' }));
    expect(await screen.findByText(NEEDS_NETWORK)).toBeInTheDocument();
    expect(auth.current.sendVerification).not.toHaveBeenCalled();
    // Not a cooldown: it can be tried again as soon as the connection is back.
    expect(screen.getByRole('button', { name: 'Reenviar e-mail' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('"Excluir para sempre" says it needs the internet and never calls the API', async () => {
    const u = show();
    await u.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    const dialog = screen.getByRole('dialog', { name: 'Excluir minha conta' });
    await u.type(within(dialog).getByLabelText('Digite EXCLUIR'), 'EXCLUIR');
    await u.click(within(dialog).getByRole('button', { name: 'Excluir para sempre' }));
    expect(await within(dialog).findByText(NEEDS_NETWORK)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Excluir para sempre' })).not.toHaveAttribute('aria-disabled');
  });
});
