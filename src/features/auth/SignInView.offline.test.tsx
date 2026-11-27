import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetOffline, setOffline } from '@/features/offline/test-offline';
import { auth, fill, resetSignIn, tab } from './test-signin';

vi.mock('next/offline', async () => (await import('@/features/offline/test-offline')).offlineModule);
vi.mock('next/navigation', async () => (await import('./test-signin')).navigationModule);
vi.mock('./firebase-client', async () => (await import('./test-signin')).firebaseClientModule);
vi.mock('./useAuth', async () => (await import('./test-signin')).useAuthModule);

import { SignInView } from './SignInView';

const NEEDS_NETWORK = 'Você precisa de internet para isso.';

beforeEach(() => {
  resetSignIn();
  resetOffline();
});
afterEach(() => vi.unstubAllGlobals());

describe('SignInView offline', () => {
  it('"Entrar" says it needs the internet and never asks Firebase', async () => {
    render(<SignInView />);
    setOffline(true);
    const u = await fill('ana@exemplo.com', 'senha-segura');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(NEEDS_NETWORK)).toBeInTheDocument();
    expect(auth.current.signInWithEmail).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Entrar' })).not.toHaveAttribute('aria-disabled');
  });

  it('"Criar conta" says it needs the internet and never asks Firebase', async () => {
    render(<SignInView />);
    setOffline(true);
    await userEvent.setup().click(tab('Criar conta'));
    const u = await fill('ana@exemplo.com', 'senha-segura');
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText(NEEDS_NETWORK)).toBeInTheDocument();
    expect(auth.current.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('"Continuar com Google" says it needs the internet and never asks Firebase', async () => {
    render(<SignInView />);
    setOffline(true);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continuar com Google' }));
    expect(await screen.findByText(NEEDS_NETWORK)).toBeInTheDocument();
    expect(auth.current.signInWithGoogle).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument();
  });

  it('the reset link says it needs the internet and never calls the API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(<SignInView />);
    setOffline(true);
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Esqueci minha senha' }));
    await u.type(screen.getByLabelText('E-mail'), 'ana@exemplo.com');
    await u.click(screen.getByRole('button', { name: 'Enviar link' }));
    expect(await screen.findByText(NEEDS_NETWORK)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('works again once the connection is back', async () => {
    render(<SignInView />);
    setOffline(true);
    setOffline(false);
    const u = await fill('ana@exemplo.com', 'senha-segura');
    await u.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(auth.current.signInWithEmail).toHaveBeenCalledWith('ana@exemplo.com', 'senha-segura');
    expect(screen.queryByText(NEEDS_NETWORK)).toBeNull();
  });
});
