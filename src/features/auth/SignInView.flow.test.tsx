import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REDIRECT_FLAG } from './sign-in';
import { authError } from './test-firebase';
import { auth, deferred, fill, nav, resetSignIn, tab } from './test-signin';

vi.mock('next/navigation', async () => (await import('./test-signin')).navigationModule);
vi.mock('./firebase-client', async () => (await import('./test-signin')).firebaseClientModule);
vi.mock('./useAuth', async () => (await import('./test-signin')).useAuthModule);

import { SignInView } from './SignInView';

beforeEach(resetSignIn);

describe('SignInView: where it goes next', () => {
  it('creates the account with the trimmed name and goes to the list', async () => {
    render(<SignInView />);
    const u = userEvent.setup();
    await u.click(tab('Criar conta'));
    await u.type(screen.getByLabelText(/Nome/), '  Ana  ');
    await fill(' ana@exemplo.com ', 'senha-boa-123');
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(auth.current.signUpWithEmail).toHaveBeenCalledWith('Ana', 'ana@exemplo.com', 'senha-boa-123');
    expect(nav.replace).toHaveBeenCalledWith('/minha-lista');
  });

  it('signs in with Google and follows a safe ?voltar=', async () => {
    nav.search = 'voltar=%2Ffilme%2F438631-duna';
    render(<SignInView />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(auth.current.signInWithGoogle).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith('/filme/438631-duna');
  });

  it('ignores ?voltar= pointing at another site', async () => {
    nav.search = 'voltar=https%3A%2F%2Fmal.com';
    render(<SignInView />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(nav.replace).toHaveBeenCalledWith('/minha-lista');
  });

  it('sends someone already signed in to ?voltar=, else to their account', () => {
    auth.current = { ...auth.current, status: 'signed-in' };
    nav.search = 'voltar=%2Fminha-lista%3Faba%3Dassistindo';
    const { unmount } = render(<SignInView />);
    expect(nav.replace).toHaveBeenLastCalledWith('/minha-lista?aba=assistindo');
    unmount();
    nav.search = 'voltar=%2F%2Fmal.com';
    const second = render(<SignInView />);
    expect(nav.replace).toHaveBeenLastCalledWith('/conta');
    second.unmount();
    // Dot segments that the URL parser would collapse into //evil.com: no zero-click bounce off the site.
    nav.search = `voltar=${encodeURIComponent('/.//evil.com')}`;
    render(<SignInView />);
    expect(nav.replace).toHaveBeenLastCalledWith('/conta');
  });

  it('does not jump to the account while its own sign-in is finishing', async () => {
    const pending = deferred();
    vi.mocked(auth.current.signInWithEmail).mockReturnValueOnce(pending.promise);
    const view = render(<SignInView />);
    const u = await fill('ana@exemplo.com', 'senha-boa-123');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    auth.current = { ...auth.current, status: 'signed-in' };
    view.rerender(<SignInView />);
    expect(nav.replace).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    expect(nav.replace).toHaveBeenCalledTimes(1);
    expect(nav.replace).toHaveBeenCalledWith('/minha-lista');
  });

  // Becoming signed in switches the library to the account: LibraryProvider renders nothing for one pass, then mounts
  // the page again under a new key.
  it('still goes to the list when the switch to the account remounts the page mid sign-in', async () => {
    const pending = deferred();
    vi.mocked(auth.current.signInWithEmail).mockReturnValueOnce(pending.promise);
    const view = render(<SignInView key="guest" />);
    const u = await fill('ana@exemplo.com', 'senha-boa-123');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    auth.current = { ...auth.current, status: 'signed-in' };
    view.rerender(<></>);
    view.rerender(<SignInView key="account" />);
    await act(async () => pending.resolve());
    expect(nav.replace).toHaveBeenCalled();
    expect(nav.replace).not.toHaveBeenCalledWith('/conta');
    expect(nav.replace).toHaveBeenLastCalledWith('/minha-lista');
  });

  it('forgets a failed sign-in: arriving signed in later still goes to the account', async () => {
    vi.mocked(auth.current.signInWithEmail).mockRejectedValueOnce(authError('auth/invalid-credential'));
    const view = render(<SignInView key="first" />);
    const u = await fill('ana@exemplo.com', 'senha-errada');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    auth.current = { ...auth.current, status: 'signed-in' };
    view.rerender(<></>);
    view.rerender(<SignInView key="later" />);
    expect(nav.replace).toHaveBeenLastCalledWith('/conta');
  });

  it('sends a later visit, once signed in, to the account again', async () => {
    const view = render(<SignInView key="guest" />);
    const u = await fill('ana@exemplo.com', 'senha-boa-123');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    auth.current = { ...auth.current, status: 'signed-in' };
    view.rerender(<></>);
    view.rerender(<SignInView key="account" />);
    expect(nav.replace).toHaveBeenLastCalledWith('/minha-lista');
    view.rerender(<></>);
    view.rerender(<SignInView key="later-visit" />);
    expect(nav.replace).toHaveBeenLastCalledWith('/conta');
  });

  it('treats the return from the Google redirect as a fresh sign-in', () => {
    window.sessionStorage.setItem(REDIRECT_FLAG, '1');
    const view = render(<SignInView />);
    auth.current = { ...auth.current, status: 'signed-in' };
    view.rerender(<SignInView />);
    expect(nav.replace).toHaveBeenCalledWith('/minha-lista');
  });
});

describe('SignInView: forgotten password', () => {
  it('swaps the form for the reset form, keeping the e-mail, and comes back', async () => {
    render(<SignInView />);
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await u.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
    const form = screen.getByRole('form', { name: 'Esqueci minha senha' });
    expect(within(form).getByLabelText('E-mail')).toHaveValue('ana@exemplo.com');
    expect(within(form).getByLabelText('E-mail')).toHaveFocus();
    expect(within(form).getByRole('button', { name: 'Enviar link' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(tab('Entrar')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@exemplo.com');
    expect(screen.getByRole('button', { name: 'Esqueci minha senha' })).toHaveFocus();
  });
});
