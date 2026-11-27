import 'fake-indexeddb/auto';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLeaving, markLeaving } from '@/features/offline/leaving';
import type { OfflineStore } from '@/features/offline/store-types';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { LibraryProvider } from '../LibraryProvider';
import type { LibraryMode } from '../mode-repository';
import type { TvProgressInfo } from '../progress';
import type { LibraryRepository } from '../repository';
import { freshStore } from '../test-library-server';
import { EMPTY_LIBRARY } from '../types';
import { useTvProgress } from './useTvProgress';

const info = (tvId: number, episodes = 3): TvProgressInfo => ({
  tvId,
  ended: false,
  seasons: [{ seasonNumber: 1, episodeCount: episodes }],
  lastAired: { seasonNumber: 1, episodeNumber: episodes },
  nextToAir: null,
});

const PROGRESS = `${window.location.origin}/api/tv/progress`;
let requests = 0;
const answer = (episodes = 3) =>
  server.use(
    http.get(PROGRESS, ({ request }) => {
      requests += 1;
      const ids = new URL(request.url).searchParams.get('ids')!.split(',').map(Number);
      return HttpResponse.json(Object.fromEntries(ids.map((id) => [String(id), info(id, episodes)])));
    }),
  );
const noNetwork = () =>
  server.use(
    http.get(PROGRESS, () => {
      requests += 1;
      return HttpResponse.error();
    }),
  );

const repository: LibraryRepository = {
  persistent: true,
  load: async () => EMPTY_LIBRARY,
  apply: async () => EMPTY_LIBRARY,
  subscribe: () => () => {},
};

const account = (uid: string): LibraryMode => ({ kind: 'account', uid });

function renderProgress(mode: LibraryMode, ids: number[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider mode={mode} repository={repository}>
          {children}
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useTvProgress(ids), { wrapper });
}

const settle = (ms = 150) => act(() => new Promise((r) => setTimeout(r, ms)));

let store: OfflineStore;
beforeEach(async () => {
  requests = 0;
  store = await freshStore();
});
afterEach(() => {
  clearLeaving('ana');
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
});

describe('useTvProgress on the device', () => {
  it('keeps the last answer on the device and shows it when the request fails for lack of network', async () => {
    answer();
    const online = renderProgress(account('ana'), [1, 2]);
    await waitFor(() => expect(Object.keys(online.result.current).sort()).toEqual(['1', '2']));
    await waitFor(async () => expect(await store.getMeta('progress:ana')).toBeDefined());
    online.unmount();

    noNetwork();
    const offline = renderProgress(account('ana'), [2]);
    await waitFor(() => expect(offline.result.current).toEqual({ 2: info(2) }));
  });

  it('never shows the answer kept for another identity', async () => {
    await store.setMeta('progress:ana', [info(1)]);
    noNetwork();
    const other = renderProgress(account('bia'), [1]);
    const guest = renderProgress({ kind: 'guest' }, [1]);
    await waitFor(() => expect(requests).toBeGreaterThanOrEqual(2));
    await settle();
    expect(other.result.current).toEqual({});
    expect(guest.result.current).toEqual({});
  });

  it('answers from the device copy even when the browser already reports the connection lost', async () => {
    await store.setMeta('progress:guest', [info(1)]);
    noNetwork();
    onlineManager.setOnline(false);
    const { result } = renderProgress({ kind: 'guest' }, [1]);
    await waitFor(() => expect(result.current).toEqual({ 1: info(1) }));
  });

  it('asks the server again as soon as the connection is back, replacing the device copy on screen', async () => {
    await store.setMeta('progress:guest', [info(1)]);
    noNetwork();
    const { result } = renderProgress({ kind: 'guest' }, [1]);
    await waitFor(() => expect(result.current).toEqual({ 1: info(1) }));

    answer(5);
    act(() => {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
    });
    await waitFor(() => expect(result.current).toEqual({ 1: info(1, 5) }));
  });

  it('keeps the newest answer of each series across different requests', async () => {
    await store.setMeta('progress:guest', [info(1), info(2)]);
    answer(7);
    const online = renderProgress({ kind: 'guest' }, [2]);
    await waitFor(() => expect(online.result.current).toEqual({ 2: info(2, 7) }));
    await waitFor(async () => expect(await store.getMeta('progress:guest')).toContainEqual(info(2, 7)));
    online.unmount();

    noNetwork();
    const offline = renderProgress({ kind: 'guest' }, [1, 2]);
    await waitFor(() => expect(offline.result.current).toEqual({ 1: info(1), 2: info(2, 7) }));
  });

  it('keeps nothing of an answer that lands after "Sair" started and wiped the account', async () => {
    let release = () => {};
    let asked = false;
    server.use(
      http.get(PROGRESS, async () => {
        asked = true;
        await new Promise<void>((r) => (release = r));
        return HttpResponse.json({ 1: info(1) });
      }),
    );
    const { result } = renderProgress(account('ana'), [1]);
    await waitFor(() => expect(asked).toBe(true));
    // What leave() does, in order: mark the account as leaving, then wipe it.
    markLeaving('ana');
    await store.wipeAccount('ana');
    release();
    await waitFor(() => expect(result.current).toEqual({ 1: info(1) }));
    await settle();
    expect(await store.getMeta('progress:ana')).toBeUndefined();
  });

  it('keeps nothing while the identity is still unknown', async () => {
    answer();
    const { result } = renderProgress({ kind: 'pending' }, [1]);
    await waitFor(() => expect(result.current).toEqual({ 1: info(1) }));
    await settle();
    expect(await store.getMeta('progress:pending')).toBeUndefined();
  });

  it('ignores a broken device copy', async () => {
    await store.setMeta('progress:guest', { 1: 'nope' });
    noNetwork();
    const { result } = renderProgress({ kind: 'guest' }, [1]);
    await waitFor(() => expect(requests).toBeGreaterThanOrEqual(1));
    await settle();
    expect(result.current).toEqual({});
  });
});
