import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { movie, tv } from '@/test/media';
import { PosterCard } from './PosterCard';

describe('PosterCard', () => {
  it('links to the canonical media URL', () => {
    render(<PosterCard item={movie({ title: 'Clube da Luta', id: 550, voteAverage: 8.4 })} />);
    expect(screen.getByRole('link', { name: /Clube da Luta/ })).toHaveAttribute(
      'href',
      '/filme/550-clube-da-luta',
    );
  });

  it('shows the rating ring', () => {
    render(<PosterCard item={movie({ voteAverage: 8.4 })} />);
    expect(screen.getByRole('img', { name: 'Nota 8,4 de 10' })).toBeInTheDocument();
  });

  it('renders a placeholder instead of a broken image when there is no poster', () => {
    render(<PosterCard item={tv({ posterPath: null, title: 'X' })} />);
    expect(screen.getByText('Série')).toBeInTheDocument();
    expect(screen.getByTestId('poster-placeholder')).toHaveTextContent('X');
    expect(document.querySelector('img')).toBeNull();
  });

  it('loads lazily unless priority', () => {
    const { rerender } = render(<PosterCard item={movie()} />);
    expect(document.querySelector('img')).toHaveAttribute('loading', 'lazy');
    rerender(<PosterCard item={movie()} priority />);
    expect(document.querySelector('img')).toHaveAttribute('loading', 'eager');
  });
});
