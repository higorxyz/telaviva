import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { movie } from '@/test/media';
import { Rail } from './Rail';

const five = [1, 2, 3, 4, 5].map((id) => movie({ id, title: `Filme ${id}` }));
const title = { lead: 'Séries', accent: 'em alta' };

describe('Rail', () => {
  it('is a labelled region', () => {
    render(<Rail id="r" title={title} href="/series/em-alta" items={five} />);
    expect(screen.getByRole('region', { name: 'Séries em alta' })).toBeInTheDocument();
  });

  it('links to the full list', () => {
    render(<Rail id="r" title={title} href="/series/em-alta" items={five} />);
    expect(screen.getByRole('link', { name: 'Ver tudo: Séries em alta' })).toHaveAttribute(
      'href',
      '/series/em-alta',
    );
  });

  it('renders one list item per title', () => {
    render(<Rail id="r" title={title} items={five} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });
});
