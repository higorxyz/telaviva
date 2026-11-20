import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

vi.mock('next/navigation', () => ({ usePathname: () => '/series', useSearchParams: () => new URLSearchParams('a=1') }));
const auth = vi.hoisted(() => ({ status: 'guest' as string }));
vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({ status: auth.status, user: { name: 'Ana', email: 'ana@exemplo.com' } }),
}));

describe('Header', () => {
  it('marks the active link and offers search', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Séries' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Filmes' })).not.toHaveAttribute('aria-current');
    const trigger = screen.getByRole('button', { name: /Buscar/ });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveTextContent('Ctrl K');
  });

  it('puts the account entry in the header: "Entrar" for a guest, the initial once signed in', () => {
    auth.status = 'guest';
    const { unmount } = render(<Header />);
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      `/entrar?voltar=${encodeURIComponent('/series?a=1')}`,
    );
    unmount();
    auth.status = 'signed-in';
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Sua conta' })).toHaveAttribute('href', '/conta');
  });

  it('shows no account entry while loading or when sign-in is off', () => {
    for (const status of ['loading', 'disabled']) {
      auth.status = status;
      const { unmount } = render(<Header />);
      expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Sua conta' })).toBeNull();
      unmount();
    }
  });
});
