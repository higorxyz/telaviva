import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabBar } from './TabBar';

vi.mock('next/navigation', () => ({ usePathname: () => '/filme/550-x' }));

describe('TabBar', () => {
  it('renders the navigation with 5 links and the active tab', () => {
    render(<TabBar />);
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Filmes' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks the active tab with more than color: an indicator bar and a bold label', () => {
    render(<TabBar />);
    const active = screen.getByRole('link', { name: 'Filmes' });
    expect(screen.getAllByTestId('tab-indicator')).toHaveLength(1);
    expect(active).toContainElement(screen.getByTestId('tab-indicator'));
    expect(active).toHaveClass('font-bold');
    expect(screen.getByRole('link', { name: 'Séries' })).not.toHaveClass('font-bold');
  });
});
