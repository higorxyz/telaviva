import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

vi.mock('next/navigation', () => ({ usePathname: () => '/series' }));

describe('Header', () => {
  it('marks the active link and offers search', () => {
    render(<Header />);
    expect(screen.getByRole('link', { name: 'Séries' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Filmes' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /Buscar/ })).toHaveAttribute('href', '/buscar');
  });
});
