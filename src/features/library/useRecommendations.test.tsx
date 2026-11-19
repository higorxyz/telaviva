import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { LibraryProvider } from './LibraryProvider';
import type { LibraryRepository } from './repository';
import { EMPTY_LIBRARY, type LibraryState } from './types';
import { useRecommendations } from './useRecommendations';

const snapshot = { title: 'Clube da Luta', posterPath: null, releaseDate: null, genreIds: [18] };
const withItem: LibraryState = {
  ...EMPTY_LIBRARY,
  items: [
    {
      mediaType: 'movie',
      tmdbId: 550,
      status: 'watched',
      addedAt: 'a',
      updatedAt: 'a',
      watchedAt: null,
      snapshot,
    },
    { mediaType: 'movie', tmdbId: 603, status: 'watched', addedAt: 'a', updatedAt: 'a', watchedAt: null, snapshot },
  ],
  ratings: [{ mediaType: 'movie', tmdbId: 603, score: 3, ratedAt: 'a', updatedAt: 'a' }],
};

function wrapperFor(state: LibraryState) {
  const repository: LibraryRepository = {
    load: async () => state,
    apply: async () => state,
    subscribe: () => () => {},
    persistent: true,
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ToastProvider>
          <LibraryProvider repository={repository}>{children}</LibraryProvider>
        </ToastProvider>
      </QueryClientProvider>
    );
  };
}

describe('useRecommendations', () => {
  it('posts seeds and exclusions, then returns the results', async () => {
    const seen: { body?: { seeds: { weight: number }[]; exclude: string[] } } = {};
    server.use(
      http.post('*/api/recommendations', async ({ request }) => {
        seen.body = (await request.json()) as never;
        return HttpResponse.json({ results: [{ id: 1, mediaType: 'movie', title: 'X' }] });
      }),
    );
    const { result } = renderHook(() => useRecommendations(), { wrapper: wrapperFor(withItem) });
    expect(result.current).toEqual({ items: [], ready: false });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.items).toHaveLength(1);
    expect(seen.body?.seeds.map((s) => s.weight).sort()).toEqual([-1.5, 1]);
    expect(seen.body?.exclude.sort()).toEqual(['movie:550', 'movie:603']);
  });

  it('stays off without a positive seed', async () => {
    let calls = 0;
    server.use(http.post('*/api/recommendations', () => ((calls += 1), HttpResponse.json({ results: [] }))));
    const { result } = renderHook(() => useRecommendations(), { wrapper: wrapperFor(EMPTY_LIBRARY) });
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toEqual({ items: [], ready: false });
    expect(calls).toBe(0);
  });

  it('is not ready on an error', async () => {
    server.use(http.post('*/api/recommendations', () => HttpResponse.json({}, { status: 502 })));
    const { result } = renderHook(() => useRecommendations(), { wrapper: wrapperFor(withItem) });
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current).toEqual({ items: [], ready: false });
  });
});
