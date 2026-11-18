import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { movie } from '@/test/media';
import { server } from '@/test/server';
import { useSearch } from './useSearch';

const requests: string[] = [];
const DEBOUNCE = 400;
const sleep = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const run = (q: string) => renderHook(({ q }) => useSearch(q, { debounceMs: DEBOUNCE }), { wrapper, initialProps: { q } });

beforeEach(() => {
  requests.length = 0;
  server.use(
    http.get(`${window.location.origin}/api/search`, ({ request }) => {
      requests.push(new URL(request.url).search);
      return HttpResponse.json({
        page: 1,
        totalPages: 1,
        totalResults: 1,
        results: [movie({ id: 603, title: 'Matrix' })],
      });
    }),
  );
});

describe('useSearch', () => {
  it('debounces rapid typing into a single request for the last value', async () => {
    const { result, rerender } = run('ma');
    for (const q of ['mat', 'matr', 'matrix']) {
      await sleep(10);
      rerender({ q });
    }
    expect(requests).toEqual([]);
    await waitFor(() => expect(result.current.status).toBe('success'));
    await sleep(DEBOUNCE * 2);
    expect(requests).toEqual(['?q=matrix&page=1']);
    expect(result.current.results).toHaveLength(1);
  });

  it('stays "loading" (not success) while the debounce is pending or placeholder data shows', async () => {
    const { result, rerender } = run('matrix');
    await waitFor(() => expect(result.current.status).toBe('success'));
    rerender({ q: 'dune' });
    expect(result.current.status).toBe('loading');
    expect(result.current.results).toHaveLength(1);
    await waitFor(() => expect(requests).toContain('?q=dune&page=1'));
    await waitFor(() => expect(result.current.status).toBe('success'));
  });

  it('encodes special characters', async () => {
    const { result } = run('a&b');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(requests).toEqual(['?q=a%26b&page=1']);
  });

  it('does not request for blank or too-short queries', async () => {
    const { result } = run('  ');
    await sleep(DEBOUNCE * 3);
    expect(requests).toEqual([]);
    expect(result.current).toMatchObject({ status: 'idle', results: [], isFetching: false });
  });

  it('reports errors', async () => {
    server.use(http.get(`${window.location.origin}/api/search`, () => HttpResponse.json({}, { status: 502 })));
    const { result } = run('matrix');
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
