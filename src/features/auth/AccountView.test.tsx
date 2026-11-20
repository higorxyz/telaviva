import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import type { AuthApi } from './auth-context';
import { AccountView } from './AccountView';
import { sessionUser, url } from './test-auth';
import { auth, resetSignIn } from './test-signin';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, prefetch: vi.fn() }),
}));
vi.mock('./useAuth', async () => (await import('./test-signin')).useAuthModule);

beforeEach(() => {
  resetSignIn();
  nav.push.mockReset();
  nav.replace.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const as = (status: AuthApi['status'], user: AuthApi['user'] = null) => {
  auth.current = { ...auth.current, status, user };
};
const ana = (overrides = {}) => sessionUser('u1', { name: 'Ana Souza', email: 'ana@exemplo.com', ...overrides });
const show = () =>
  render(
    <ToastProvider>
      <AccountView />
    </ToastProvider>,
  );

describe('AccountView', () => {
  it('shows a placeholder while sign-in resolves', () => {
    as('loading');
    show();
    expect(screen.getByText('Carregando sua conta…')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('asks a visitor to sign in, coming back here', () => {
    as('guest');
    show();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar?voltar=/conta');
    expect(screen.queryByRole('button', { name: 'Sair' })).toBeNull();
  });

  it('shows nothing with sign-in off', () => {
    as('disabled');
    show();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Carregando sua conta…')).toBeNull();
  });

  it('shows the name, e-mail, initial, provider and an unconfirmed e-mail', () => {
    as('signed-in', ana({ provider: 'password' }));
    show();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('ana@exemplo.com')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('E-mail e senha')).toBeInTheDocument();
    expect(screen.getByText('E-mail não confirmado')).toBeInTheDocument();
    for (const name of ['Sair', 'Exportar meus dados', 'Excluir minha conta']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('shows the photo and Google for a confirmed Google account', () => {
    as('signed-in', ana({ provider: 'google', emailVerified: true, photoUrl: 'https://exemplo.com/ana.png' }));
    show();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('E-mail confirmado')).toBeInTheDocument();
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://exemplo.com/ana.png');
  });

  it('"Sair" signs out, then goes home', async () => {
    as('signed-in', ana());
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));
    expect(auth.current.signOut).toHaveBeenCalled();
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/'));
  });

  it('"Exportar meus dados" downloads the JSON under the server\'s file name', async () => {
    const createObjectURL = vi.fn(() => 'blob:telaviva/1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('telaviva-meus-dados-2026-11-20.json');
      expect(this.href).toBe('blob:telaviva/1');
    });
    server.use(
      http.get(url('/api/account/export'), ({ request }) =>
        request.headers.get('x-expected-user') !== 'u1'
          ? HttpResponse.json({ error: 'wrong_account' }, { status: 409 })
          : HttpResponse.json(
          { exportedAt: 'x' },
          { headers: { 'Content-Disposition': 'attachment; filename="telaviva-meus-dados-2026-11-20.json"' } },
        ),
      ),
    );
    as('signed-in', ana());
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar meus dados' }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:telaviva/1'));
    click.mockRestore();
  });

  it('409 (another tab switched accounts): says so and reloads who is signed in', async () => {
    server.use(http.get(url('/api/account/export'), () => HttpResponse.json({ error: 'wrong_account' }, { status: 409 })));
    as('signed-in', ana());
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar meus dados' }));
    expect(await screen.findByText('A conta aberta mudou em outra aba. Confira e tente de novo.')).toBeInTheDocument();
    expect(auth.current.refresh).toHaveBeenCalled();
  });

  it('says so in a toast when the export fails', async () => {
    server.use(http.get(url('/api/account/export'), () => HttpResponse.json({ error: 'x' }, { status: 500 })));
    as('signed-in', ana());
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Exportar meus dados' }));
    expect(await screen.findByText('Não foi possível exportar seus dados. Tente de novo.')).toBeInTheDocument();
  });
});
