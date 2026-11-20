import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/server';
import type { TvProgressInfo } from '../progress';
import { useTvProgress } from './useTvProgress';

const info = (tvId: number): TvProgressInfo => ({
  tvId,
  ended: false,
  seasons: [{ seasonNumber: 1, episodeCount: 3 }],
  lastAired: { seasonNumber: 1, episodeNumber: 3 },
  nextToAir: null,
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // retry is set by the hook itself (1), so tests below wait a moment for it.
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useTvProgress', () => {
  it('keeps the previous answer while a changed id set is being fetched', async () => {
    let release: () => void = () => {};
    server.use(
      http.get(`${window.location.origin}/api/tv/progress`, async ({ request }) => {
        const ids = new URL(request.url).searchParams.get('ids')!.split(',').map(Number);
        if (ids.length > 1) await new Promise<void>((r) => (release = r));
        return HttpResponse.json(Object.fromEntries(ids.map((id) => [String(id), info(id)])));
      }),
    );
    const { result, rerender } = renderHook(({ ids }) => useTvProgress(ids), {
      wrapper: wrapper(),
      initialProps: { ids: [1] },
    });
    await waitFor(() => expect(Object.keys(result.current)).toEqual(['1']));

    rerender({ ids: [1, 2] });
    await new Promise((r) => setTimeout(r, 30));
    expect(Object.keys(result.current)).toEqual(['1']);
    release();
    await waitFor(() => expect(Object.keys(result.current).sort()).toEqual(['1', '2']));
  });

  it('keeps the previous data after a 429 and caches nothing as success', async () => {
    let limited = false;
    server.use(
      http.get(`${window.location.origin}/api/tv/progress`, ({ request }) => {
        if (limited) return new HttpResponse(null, { status: 429 });
        const ids = new URL(request.url).searchParams.get('ids')!.split(',').map(Number);
        return HttpResponse.json(Object.fromEntries(ids.map((id) => [String(id), info(id)])));
      }),
    );
    const { result, rerender } = renderHook(({ ids }) => useTvProgress(ids), {
      wrapper: wrapper(),
      initialProps: { ids: [1] },
    });
    await waitFor(() => expect(Object.keys(result.current)).toEqual(['1']));

    limited = true;
    rerender({ ids: [1, 2] });
    await new Promise((r) => setTimeout(r, 1500));
    expect(Object.keys(result.current)).toEqual(['1']);
  });

  it('stays empty (graceful fallback) when the first load fails', async () => {
    server.use(http.get(`${window.location.origin}/api/tv/progress`, () => new HttpResponse(null, { status: 429 })));
    const { result } = renderHook(() => useTvProgress([1]), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 1500));
    expect(result.current).toEqual({});
  });
});
