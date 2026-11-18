import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaSummary, Paginated } from '@/features/tmdb/types';
import { movie } from '@/test/media';
import { server } from '@/test/server';
import { MediaGrid } from './MediaGrid';

const page = (n: number, totalPages: number, items: MediaSummary[]): Paginated<MediaSummary> => ({
  page: n,
  totalPages,
  totalResults: totalPages * 20,
  results: items,
});

function renderGrid(initial: Paginated<MediaSummary>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MediaGrid endpoint="/api/catalog?list=filmes/populares" initialPage={initial} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

describe('MediaGrid', () => {
  it('renders the initial items', () => {
    renderGrid(page(1, 3, [movie({ id: 1, title: 'Alfa' }), movie({ id: 2, title: 'Beta' })]));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Alfa/ })).toBeInTheDocument();
  });

  it('loads and appends the next page on "Carregar mais"', async () => {
    let requested: string | null = null;
    server.use(
      http.get(`${window.location.origin}/api/catalog`, ({ request }) => {
        requested = new URL(request.url).search;
        return HttpResponse.json(page(2, 2, [movie({ id: 3, title: 'Gama' })]));
      }),
    );
    renderGrid(page(1, 2, [movie({ id: 1, title: 'Alfa' })]));
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByRole('link', { name: /Gama/ })).toBeInTheDocument();
    expect(requested).toBe('?list=filmes/populares&page=2');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(await screen.findByText('Você chegou ao fim')).toBeInTheDocument();
  });

  it('shows the end message when there are no more pages', () => {
    renderGrid(page(1, 1, [movie()]));
    expect(screen.getByText('Você chegou ao fim')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });
});
