import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GenreTabs } from './GenreTabs';

const movie = [{ id: 28, name: 'Ação', href: '/genero/filme/28-acao', backdrop: null }];
const tv = [{ id: 18, name: 'Drama', href: '/genero/serie/18-drama', backdrop: null }];

describe('GenreTabs', () => {
  it('shows movie genres first and switches to series with the tabs', async () => {
    const user = userEvent.setup();
    render(<GenreTabs movie={movie} tv={tv} />);

    expect(screen.getByRole('tab', { name: 'Filmes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Ação' })).toHaveAttribute('href', '/genero/filme/28-acao');
    expect(screen.queryByRole('link', { name: 'Drama' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Séries' }));
    expect(screen.getByRole('tab', { name: 'Séries' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('link', { name: 'Drama' })).toHaveAttribute('href', '/genero/serie/18-drama');
    expect(screen.queryByRole('link', { name: 'Ação' })).not.toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    render(<GenreTabs movie={movie} tv={tv} />);
    screen.getByRole('tab', { name: 'Filmes' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Séries' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Séries' })).toHaveFocus();
  });
});
