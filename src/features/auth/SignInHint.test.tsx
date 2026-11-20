import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthApi } from './auth-context';
import { SignInHint } from './SignInHint';

const state = vi.hoisted(() => ({ status: 'guest' as AuthApi['status'] }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ status: state.status }) }));

describe('SignInHint', () => {
  it('invites a guest to sign in and come back to Minha lista', () => {
    state.status = 'guest';
    const { container } = render(<SignInHint />);
    expect(container).toHaveTextContent('Entre para ver sua lista em todos os aparelhos.');
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar?voltar=/minha-lista');
  });

  it.each(['loading', 'signed-in', 'disabled'] as const)('stays out of the way while %s', (status) => {
    state.status = status;
    const { container } = render(<SignInHint />);
    expect(container).toBeEmptyDOMElement();
  });
});
