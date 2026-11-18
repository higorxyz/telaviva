import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { movie } from '@/test/media';
import { server } from '@/test/server';
import { SearchView } from './SearchView';

let params = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => params }));

const person = { id: 6384, mediaType: 'person', name: 'Keanu Reeves', profilePath: null, knownForDepartment: 'Acting' };

function setup(qs: string) {
  params = new URLSearchParams(qs);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SearchView />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const respond = (results: unknown[]) =>
  server.use(
    http.get(`${window.location.origin}/api/search`, () =>
      HttpResponse.json({ page: 1, totalPages: 1, totalResults: results.length, results }),
    ),
  );

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.spyOn(window.history, 'replaceState');
  window.localStorage.clear();
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});

describe('SearchView', () => {
  it('shows the initial state with recent searches and clears them', async () => {
    window.localStorage.setItem('telaviva:recent-searches', JSON.stringify(['dune', 'matrix']));
    const user = setup('');
    expect(screen.getByText('Comece a digitar')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'dune' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.queryByRole('button', { name: 'dune' })).toBeNull();
    expect(window.localStorage.getItem('telaviva:recent-searches')).toBeNull();
  });

  it('renders media and people, and filters by tab', async () => {
    respond([movie({ id: 603, title: 'Matrix' }), person]);
    const user = setup('q=matrix');
    expect(await screen.findByRole('link', { name: /Matrix/ })).toHaveAttribute('href', '/filme/603-matrix');
    expect(screen.getByRole('link', { name: /Keanu Reeves/ })).toHaveAttribute('href', '/pessoa/6384-keanu-reeves');
    await user.click(screen.getByRole('button', { name: 'Pessoas' }));
    expect(screen.getByRole('button', { name: 'Pessoas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('link', { name: /Matrix/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Keanu Reeves/ })).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    respond([]);
    setup('q=zzzz');
    expect(await screen.findByText('Nada encontrado para "zzzz"')).toBeInTheDocument();
  });

  it('says so explicitly when a filtered tab has no matches', async () => {
    respond([movie({ id: 603, title: 'Matrix' })]);
    const user = setup('q=matrix');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(screen.getByRole('button', { name: 'Pessoas' }));
    expect(screen.getByText('Nenhuma pessoa encontrada para "matrix"')).toBeInTheDocument();
  });

  it('syncs typing into the URL with history.replaceState', async () => {
    const user = setup('');
    await user.type(screen.getByRole('searchbox'), 'a&b');
    await vi.waitFor(() => expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/buscar?q=a%26b'));
  });
});
