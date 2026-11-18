import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { movie } from '@/test/media';
import { server } from '@/test/server';
import { SearchResults, type SearchTab } from './SearchResults';

const requested: string[] = [];

beforeEach(() => {
  requested.length = 0;
  // The sentinel is always "in view": every observer fires immediately.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(private cb: (e: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.cb([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
  server.use(
    http.get(`${window.location.origin}/api/search`, ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      requested.push(String(page));
      return HttpResponse.json({
        page,
        totalPages: 50,
        totalResults: 1000,
        results: [movie({ id: page, title: `Filme ${page}` })],
      });
    }),
  );
});

function setup(tab: SearchTab) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SearchResults query="matrix" tab={tab} />
    </QueryClientProvider>,
  );
}

describe('SearchResults auto-loading', () => {
  it('does not chain page loads when a page adds nothing to the active tab', async () => {
    setup('person');
    expect(await screen.findByText('Nenhuma pessoa encontrada para "matrix"')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 150));
    expect(requested).toEqual(['1']);
    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument();
  });

  it('caps consecutive auto-loads, then requires "Carregar mais"', async () => {
    setup('all');
    await screen.findByRole('link', { name: /Filme 1/ });
    await new Promise((r) => setTimeout(r, 300));
    expect(requested).toEqual(['1', '2', '3', '4']);
    expect(screen.getByRole('button', { name: 'Carregar mais' })).toBeInTheDocument();
  });
});
