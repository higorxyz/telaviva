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
});
