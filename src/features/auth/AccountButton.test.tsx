import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountButton } from './AccountButton';
import type { AuthApi } from './auth-context';
import { sessionUser } from './test-auth';

const nav = vi.hoisted(() => ({ pathname: '/series', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
const state = vi.hoisted(() => ({ api: {} as Partial<AuthApi> }));
vi.mock('./useAuth', () => ({ useAuth: () => state.api }));

const as = (status: AuthApi['status'], user: AuthApi['user'] = null) => {
  state.api = { status, user };
};

describe('AccountButton', () => {
  beforeEach(() => {
    nav.pathname = '/series';
    nav.search = '';
  });

  it('reserves an empty, hidden box while loading', () => {
    as('loading');
    const { container } = render(<AccountButton />);
    expect(container).toHaveTextContent('');
    expect(screen.queryByRole('link')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveClass('h-9', 'w-20');
  });

  it('keeps the same 80 px box for the signed-in avatar, pinned to the right edge', () => {
    as('loading');
    const { container, unmount } = render(<AccountButton />);
    const reserved = container.firstElementChild;
    expect(reserved).toHaveClass('w-20');
    unmount();
    as('signed-in', sessionUser('a', { name: 'Ana' }));
    render(<AccountButton />);
    const box = screen.getByRole('link', { name: 'Sua conta' }).parentElement;
    expect(box).toHaveClass('flex', 'h-9', 'w-20', 'shrink-0', 'justify-end');
  });

  it('renders nothing when sign-in is off', () => {
    as('disabled');
    const { container } = render(<AccountButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers "Entrar" with the current path and search encoded in voltar', () => {
    as('guest');
    nav.pathname = '/filmes';
    nav.search = 'genero=18&ordem=nota';
    render(<AccountButton />);
    const link = screen.getByRole('link', { name: 'Entrar' });
    expect(link).toHaveAttribute('href', `/entrar?voltar=${encodeURIComponent('/filmes?genero=18&ordem=nota')}`);
    expect(link).toHaveClass('h-9', 'w-20'); // the same box as the placeholder: no shift
  });

  it('shows the initial of the name, linking to /conta', () => {
    as('signed-in', sessionUser('a', { name: 'ana souza' }));
    render(<AccountButton />);
    const link = screen.getByRole('link', { name: 'Sua conta' });
    expect(link).toHaveAttribute('href', '/conta');
    expect(link).toHaveTextContent('A');
    expect(link).not.toHaveAttribute('aria-current');
  });

  it('falls back to the e-mail initial, then to an icon', () => {
    as('signed-in', sessionUser('bia', { name: null, email: 'bia@exemplo.com' }));
    const { unmount } = render(<AccountButton />);
    expect(screen.getByRole('link', { name: 'Sua conta' })).toHaveTextContent('B');
    unmount();
    as('signed-in', sessionUser('x', { name: ' ', email: null }));
    render(<AccountButton />);
    const link = screen.getByRole('link', { name: 'Sua conta' });
    expect(link).toHaveTextContent('');
    expect(link.querySelector('svg')).not.toBeNull();
  });

  it('marks /conta as the current page', () => {
    as('signed-in', sessionUser('a', { name: 'Ana' }));
    nav.pathname = '/conta';
    render(<AccountButton />);
    expect(screen.getByRole('link', { name: 'Sua conta' })).toHaveAttribute('aria-current', 'page');
  });
});
