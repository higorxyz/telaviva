import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LibraryProvider } from '@/features/library/LibraryProvider';
import type { LibraryRepository } from '@/features/library/repository';
import { EMPTY_LIBRARY } from '@/features/library/types';
import { movie, tv } from '@/test/media';
import { ToastProvider } from '@/ui/toast/ToastProvider';
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

  it('can show a personal rating on the ring instead of the TMDb average', () => {
    render(<PosterCard item={movie({ voteAverage: 8.4 })} ringValue={9} ringTone="personal" />);
    expect(screen.getByRole('img', { name: 'Sua nota 9,0 de 10' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Nota 8,4/ })).toBeNull();
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

describe('PosterCard library action', () => {
  const repository: LibraryRepository = {
    persistent: true,
    load: async () => EMPTY_LIBRARY,
    apply: async () => EMPTY_LIBRARY,
    subscribe: () => () => {},
  };
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <LibraryProvider repository={repository}>{node}</LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );

  it('renders the quick action outside the link', async () => {
    render(wrap(<PosterCard item={movie({ title: 'Duna' })} />));
    const button = await screen.findByRole('button', { name: 'Adicionar Duna a Quero ver' });
    expect(screen.getByRole('link').contains(button)).toBe(false);
  });

  it('is tabbable in a grid and out of the tab order when the card has a roving tabIndex', async () => {
    const { rerender } = render(wrap(<PosterCard item={movie({ title: 'Duna' })} />));
    expect(await screen.findByRole('button', { name: /Adicionar/ })).not.toHaveAttribute('tabindex');
    rerender(wrap(<PosterCard item={movie({ title: 'Duna' })} tabIndex={0} />));
    expect(screen.getByRole('button', { name: /Adicionar/ })).toHaveAttribute('tabindex', '-1');
  });

  it('skips the library action when libraryAction is false', async () => {
    render(wrap(<PosterCard item={movie()} libraryAction={false} />));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lets explicit actions win over the library action', async () => {
    render(wrap(<PosterCard item={movie()} actions={<button type="button">Custom</button>} />));
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: /Adicionar/ })).toBeNull();
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
