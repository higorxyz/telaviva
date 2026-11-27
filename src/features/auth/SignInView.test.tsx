import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authError } from './test-firebase';
import { auth, deferred, fill, preload, resetSignIn, tab } from './test-signin';

vi.mock('next/navigation', async () => (await import('./test-signin')).navigationModule);
vi.mock('./firebase-client', async () => (await import('./test-signin')).firebaseClientModule);
vi.mock('./useAuth', async () => (await import('./test-signin')).useAuthModule);

import { SignInView } from './SignInView';

const GOOGLE_HINT = "Se você criou a conta com o Google, use 'Continuar com Google'.";

beforeEach(resetSignIn);

describe('SignInView', () => {
  it('starts loading Firebase as soon as it mounts, so the popup keeps the click', () => {
    render(<SignInView />);
    expect(preload).toHaveBeenCalledTimes(1);
  });

  it('shows Google, the two tabs and the privacy notice', () => {
    render(<SignInView />);
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument();
    expect(tab('Entrar')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Criar conta')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Entrar');
    expect(
      screen.getByText('Guardamos seu nome, seu e-mail e sua lista. Você pode exportar ou excluir tudo em Sua conta.'),
    ).toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys, Home and End (roving focus)', async () => {
    const u = userEvent.setup();
    render(<SignInView />);
    expect(tab('Entrar')).toHaveAttribute('tabindex', '0');
    expect(tab('Criar conta')).toHaveAttribute('tabindex', '-1');
    tab('Entrar').focus();
    await u.keyboard('{ArrowRight}');
    expect(tab('Criar conta')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Criar conta')).toHaveFocus();
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Criar conta');
    await u.keyboard('{ArrowRight}');
    expect(tab('Entrar')).toHaveFocus();
    await u.keyboard('{ArrowLeft}');
    expect(tab('Criar conta')).toHaveFocus();
    await u.keyboard('{Home}');
    expect(tab('Entrar')).toHaveAttribute('aria-selected', 'true');
    await u.keyboard('{End}');
    expect(tab('Criar conta')).toHaveAttribute('aria-selected', 'true');
  });

  it('labels every field and sets autocomplete per tab', async () => {
    render(<SignInView />);
    expect(screen.queryByLabelText(/Nome/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
    await userEvent.setup().click(tab('Criar conta'));
    expect(screen.getByLabelText(/Nome/)).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.queryByRole('button', { name: 'Esqueci minha senha' })).not.toBeInTheDocument();
  });

  it('refuses a short password on sign-up without calling Firebase', async () => {
    render(<SignInView />);
    await userEvent.setup().click(tab('Criar conta'));
    const u = await fill('ana@exemplo.com', 'curta12');
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use uma senha com pelo menos 8 caracteres.');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.current.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('refuses a malformed e-mail without calling Firebase', async () => {
    render(<SignInView />);
    const u = await fill('ana@', 'senha-boa-123');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confira o e-mail digitado.');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.current.signInWithEmail).not.toHaveBeenCalled();
  });

  it('shows the exact Firebase copy, plus the Google hint for wrong credentials', async () => {
    vi.mocked(auth.current.signInWithEmail).mockRejectedValueOnce(authError('auth/invalid-credential'));
    render(<SignInView />);
    const u = await fill('ana@exemplo.com', 'senha-errada');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('E-mail ou senha incorretos.');
    // The hint is inside the alert, so it is announced with it.
    expect(alert).toHaveTextContent(GOOGLE_HINT);
    expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-describedby');
    expect(auth.current.signInWithEmail).toHaveBeenCalledWith('ana@exemplo.com', 'senha-errada');
  });

  it('mounts a fresh alert when the same error comes back, so it is announced again', async () => {
    vi.mocked(auth.current.signInWithEmail).mockRejectedValue(authError('auth/invalid-credential'));
    render(<SignInView />);
    const u = await fill('ana@exemplo.com', 'senha-errada');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    const first = await screen.findByRole('alert');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    const second = await screen.findByRole('alert');
    expect(second).toHaveTextContent('E-mail ou senha incorretos.');
    expect(second).not.toBe(first);

    await u.clear(screen.getByLabelText('E-mail'));
    await u.type(screen.getByLabelText('E-mail'), 'ana@');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    const invalid = screen.getByRole('alert');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Confira o e-mail digitado.');
    expect(screen.getByRole('alert')).not.toBe(invalid);
  });

  it('shows other errors without the Google hint, and clears them on the other tab', async () => {
    vi.mocked(auth.current.signUpWithEmail).mockRejectedValueOnce(authError('auth/email-already-in-use'));
    render(<SignInView />);
    await userEvent.setup().click(tab('Criar conta'));
    const u = await fill('ana@exemplo.com', 'senha-boa-123');
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma conta com esse e-mail.');
    expect(screen.queryByText(GOOGLE_HINT)).not.toBeInTheDocument();
    await u.click(tab('Entrar'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('marks both buttons unavailable while signing in, keeping focus and ignoring more clicks', async () => {
    const pending = deferred();
    vi.mocked(auth.current.signInWithEmail).mockReturnValueOnce(pending.promise);
    render(<SignInView />);
    const u = await fill('ana@exemplo.com', 'senha-boa-123');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    const submit = screen.getByRole('button', { name: 'Entrando…' });
    const google = screen.getByRole('button', { name: 'Continuar com Google' });
    expect(submit).toHaveAttribute('aria-disabled', 'true');
    expect(google).toHaveAttribute('aria-disabled', 'true');
    // aria-disabled, not disabled: the focused button keeps focus for keyboard and screen reader users.
    expect(submit).toHaveFocus();
    await u.click(submit);
    await u.click(google);
    expect(auth.current.signInWithEmail).toHaveBeenCalledTimes(1);
    expect(auth.current.signInWithGoogle).not.toHaveBeenCalled();
    await act(async () => pending.reject(authError('auth/too-many-requests')));
    expect(screen.getByRole('alert')).toHaveTextContent('Muitas tentativas. Espere um pouco e tente de novo.');
    expect(screen.getByRole('button', { name: 'Entrar' })).not.toHaveAttribute('aria-disabled');
  });

  it('says nothing when the Google popup is closed, and the copy for other Google errors', async () => {
    vi.mocked(auth.current.signInWithGoogle)
      .mockRejectedValueOnce(authError('auth/popup-closed-by-user'))
      .mockRejectedValueOnce(authError('auth/network-request-failed'));
    render(<SignInView />);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão. Verifique sua internet.');
  });
});
