import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    expect(screen.getByTestId('poster-placeholder')).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('img')).toBeNull();
  });

  it('loads lazily unless priority', () => {
    const { rerender } = render(<PosterCard item={movie()} />);
    expect(document.querySelector('img')).toHaveAttribute('loading', 'lazy');
    rerender(<PosterCard item={movie()} priority />);
    expect(document.querySelector('img')).toHaveAttribute('loading', 'eager');
  });

  it('names the link starting with the title, then year, type and rating', () => {
    render(<PosterCard item={tv({ title: 'Duna', releaseDate: '2021-10-21', voteAverage: 8 })} />);
    expect(screen.getByRole('link')).toHaveAccessibleName('Duna (2021) — Série — Nota 8,0');
  });

  it('omits missing parts from the name', () => {
    render(<PosterCard item={movie({ title: 'Sem nota', releaseDate: null, voteAverage: 0 })} />);
    expect(screen.getByRole('link')).toHaveAccessibleName('Sem nota');
  });

  it('idle cards run no pending animation', () => {
    render(<PosterCard item={movie()} />);
    expect(screen.queryByTestId('link-pending')).toBeNull();
  });
});

describe('LinkPending', () => {
  it('shows the amber bar only while the link is pending', async () => {
    vi.resetModules();
    vi.doMock('next/link', async (importOriginal) => ({
      ...(await importOriginal<typeof import('next/link')>()),
      useLinkStatus: () => ({ pending: true }),
    }));
    const { LinkPending } = await import('./LinkPending');
    render(<LinkPending />);
    expect(screen.getByTestId('link-pending')).toHaveClass('bg-amber');
    vi.doUnmock('next/link');
  });
});
