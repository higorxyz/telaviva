import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand } from './commands';
import { useLibraryActions } from './hooks';
import { LibraryProvider } from './LibraryProvider';
import type { LibraryRepository } from './repository';
import { EMPTY_LIBRARY, type LibraryState } from './types';
import { useRecommendations } from './useRecommendations';
import { entry, stateOf } from './view/test-state';

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

const result = (id: number) => ({ id, mediaType: 'movie', title: `R${id}` });

/** A repository that really applies commands, so library changes flow through the hooks. */
function wrapperFor(initial: LibraryState) {
  let state = initial;
  const repository: LibraryRepository = {
    load: async () => state,
    apply: async (command) => (state = applyCommand(state, command, new Date().toISOString())),
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

function useBoth() {
  return { recs: useRecommendations(), actions: useLibraryActions() };
}

describe('useRecommendations', () => {
  it('posts seeds and exclusions, then returns the results', async () => {
    const seen: { body?: { seeds: { weight: number }[]; exclude: string[] } } = {};
    server.use(
      http.post('*/api/recommendations', async ({ request }) => {
        seen.body = (await request.json()) as never;
        return HttpResponse.json({ results: [result(1)] });
      }),
    );
    const { result: hook } = renderHook(() => useRecommendations(), { wrapper: wrapperFor(withItem) });
    expect(hook.current).toEqual({ items: [], total: 0, ready: false });
    await waitFor(() => expect(hook.current.ready).toBe(true));
    expect(hook.current.items).toHaveLength(1);
    expect(seen.body?.seeds.map((s) => s.weight).sort()).toEqual([-1.5, 1]);
    expect(seen.body?.exclude.sort()).toEqual(['movie:550', 'movie:603']);
  });

  it('stays off without a positive seed', async () => {
    let calls = 0;
    server.use(http.post('*/api/recommendations', () => ((calls += 1), HttpResponse.json({ results: [] }))));
    const { result: hook } = renderHook(() => useRecommendations(), { wrapper: wrapperFor(EMPTY_LIBRARY) });
    await new Promise((r) => setTimeout(r, 50));
    expect(hook.current).toEqual({ items: [], total: 0, ready: false });
    expect(calls).toBe(0);
  });

  it('is not ready on an error', async () => {
    server.use(http.post('*/api/recommendations', () => HttpResponse.json({}, { status: 502 })));
    const { result: hook } = renderHook(() => useRecommendations(), { wrapper: wrapperFor(withItem) });
    await new Promise((r) => setTimeout(r, 100));
    expect(hook.current).toEqual({ items: [], total: 0, ready: false });
  });

  it('with 600 titles in the library, sends only the 500 most recent keys and hides the rest locally', async () => {
    // Title i was updated at minute i: the 100 oldest (ids 1..100) are not sent.
    const items = Array.from({ length: 600 }, (_, i) =>
      entry('movie', i + 1, 'want', { updatedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() }),
    );
    const seen: { exclude?: string[] } = {};
    server.use(
      http.post('*/api/recommendations', async ({ request }) => {
        seen.exclude = ((await request.json()) as { exclude: string[] }).exclude;
        // The server cannot know title 7 is in the library, so it suggests it.
        return HttpResponse.json({ results: [result(7), result(9001), result(9002)] });
      }),
    );
    const { result: hook } = renderHook(() => useRecommendations(), { wrapper: wrapperFor(stateOf({ items })) });
    await waitFor(() => expect(hook.current.ready).toBe(true));
    expect(seen.exclude).toHaveLength(500);
    expect(seen.exclude).toContain('movie:600');
    expect(seen.exclude).not.toContain('movie:100');
    expect(hook.current.items.map((m) => m.id)).toEqual([9001, 9002]);
    expect(hook.current.total).toBe(3);
  });

  it('does not refetch nor blank out when a title is saved and the seeds stay the same; it hides that title', async () => {
    // Eight watched titles fill the positive seeds, so a new "Quero ver" (weight 0.5) does not change them.
    const items = Array.from({ length: 8 }, (_, i) => entry('movie', 100 + i, 'watched'));
    let calls = 0;
    server.use(
      http.post('*/api/recommendations', () => {
        calls += 1;
        return HttpResponse.json({ results: [result(1), result(2), result(3)] });
      }),
    );
    const { result: hook } = renderHook(() => useBoth(), { wrapper: wrapperFor(stateOf({ items })) });
    await waitFor(() => expect(hook.current.recs.ready).toBe(true));

    act(() =>
      hook.current.actions.run({
        type: 'setStatus',
        ref: { mediaType: 'movie', tmdbId: 2 },
        status: 'want',
        snapshot,
      }),
    );
    await waitFor(() => expect(hook.current.recs.items.map((m) => m.id)).toEqual([1, 3]));
    expect(hook.current.recs.ready).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(1);
  });

  it('keeps the previous results on screen while new seeds are being fetched', async () => {
    let release: () => void = () => {};
    let calls = 0;
    server.use(
      http.post('*/api/recommendations', async () => {
        calls += 1;
        if (calls === 2) await new Promise<void>((r) => (release = r));
        return HttpResponse.json({ results: calls === 1 ? [result(1), result(2)] : [result(5)] });
      }),
    );
    const { result: hook } = renderHook(() => useBoth(), { wrapper: wrapperFor(withItem) });
    await waitFor(() => expect(hook.current.recs.ready).toBe(true));

    // Rating 550 with a 10 changes its seed weight, so the seeds (and the query) change.
    act(() => hook.current.actions.run({ type: 'rate', ref: { mediaType: 'movie', tmdbId: 550 }, score: 10, snapshot }));
    await waitFor(() => expect(calls).toBe(2));
    expect(hook.current.recs).toMatchObject({ ready: true, items: [{ id: 1 }, { id: 2 }] });
    release();
    await waitFor(() => expect(hook.current.recs.items.map((m) => m.id)).toEqual([5]));
  });
});
