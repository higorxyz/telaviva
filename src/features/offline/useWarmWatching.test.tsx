import 'fake-indexeddb/auto';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryProvider } from '@/features/library/LibraryProvider';
import type { LibraryMode } from '@/features/library/mode-repository';
import type { TvProgressInfo } from '@/features/library/progress';
import type { LibraryRepository } from '@/features/library/repository';
import { freshStore, reportOnline } from '@/features/library/test-library-server';
import type { LibraryState } from '@/features/library/types';
import { entry, mark, stateOf } from '@/features/library/view/test-state';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import type { OfflineStore } from './store-types';
import { WarmWatching } from './useWarmWatching';

const ORIGIN = window.location.origin;
const info = (tvId: number): TvProgressInfo => ({
  tvId,
  ended: false,
  seasons: [
    { seasonNumber: 1, episodeCount: 8 },
    { seasonNumber: 2, episodeCount: 8 },
  ],
  lastAired: { seasonNumber: 2, episodeNumber: 8 },
  nextToAir: null,
});

type Seen = { path: string; warm: string | null; accept: string | null };
let warmed: Seen[] = [];
let progressAsked = 0;

beforeEach(() => {
  warmed = [];
  progressAsked = 0;
  server.use(
    http.get(`${ORIGIN}/api/tv/progress`, ({ request }) => {
      progressAsked += 1;
      const ids = new URL(request.url).searchParams.get('ids')!.split(',').map(Number);
      return HttpResponse.json(Object.fromEntries(ids.map((id) => [String(id), info(id)])));
    }),
    http.get(`${ORIGIN}/serie/:slug`, ({ request }) => {
      warmed.push(seen(request));
      return new HttpResponse('<!doctype html><title>x</title>', { headers: { 'Content-Type': 'text/html' } });
    }),
    http.get(`${ORIGIN}/api/tv/:id/season/:n`, ({ request }) => {
      warmed.push(seen(request));
      return HttpResponse.json({ episodes: [] });
    }),
  );
});

function seen(request: Request): Seen {
  return {
    path: new URL(request.url).pathname,
    warm: request.headers.get('X-TelaViva-Warm'),
    accept: request.headers.get('Accept'),
  };
}

let store: OfflineStore;
const swListeners = new Map<string, () => void>();
beforeEach(async () => {
  store = await freshStore();
  reportOnline(true);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  swListeners.clear();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: {},
      addEventListener: (type: string, listener: () => void) => swListeners.set(type, listener),
      removeEventListener: (type: string) => swListeners.delete(type),
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(navigator, 'connection');
});

const library = stateOf({
  items: [entry('tv', 7, 'watching', { title: 'Ruptura' }), entry('movie', 8, 'watching')],
  episodes: [mark(7, 1, 1)],
});

function setup(mode: LibraryMode = { kind: 'account', uid: 'ana' }, state: LibraryState = library) {
  const repository: LibraryRepository = {
    persistent: true,
    load: async () => state,
    apply: async () => state,
    subscribe: () => () => {},
  };
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <LibraryProvider mode={mode} repository={repository}>
          <WarmWatching />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const PAGE: Seen = { path: '/serie/7-ruptura', warm: '1', accept: 'text/html' };
const SEASONS = ['/api/tv/7/season/1', '/api/tv/7/season/2'];

/** Waits until the warm-up could have started (the progress it needs arrived), then a moment more. */
async function settled() {
  await waitFor(() => expect(progressAsked).toBeGreaterThan(0));
  await act(() => new Promise((r) => setTimeout(r, 150)));
}

describe('useWarmWatching', () => {
  it('saves the page and the current and next seasons of a series being watched, and when it did', async () => {
    setup();
    await waitFor(() => expect(warmed).toHaveLength(3));
    expect(warmed[0]).toEqual(PAGE);
    expect(warmed.slice(1).map((s) => s.path)).toEqual(SEASONS);
    expect(warmed.slice(1).every((s) => s.warm === null)).toBe(true);
    await waitFor(async () =>
      expect(Object.keys((await store.getMeta<Record<string, string>>('warm:ana')) ?? {})).toEqual(['tv:7']),
    );
  });

  it('keeps a visitor’s warm-ups under the guest identity', async () => {
    setup({ kind: 'guest' });
    await waitFor(async () => expect(await store.getMeta('warm:guest')).toHaveProperty('tv:7'));
  });

  it('does not warm again a series saved less than 6 h ago', async () => {
    await store.setMeta('warm:ana', { 'tv:7': new Date(Date.now() - 60_000).toISOString() });
    setup();
    await settled();
    expect(warmed).toEqual([]);
  });

  it('fetches nothing when the visitor asked to save data', async () => {
    Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } });
    setup();
    await settled();
    expect(warmed).toEqual([]);
  });

  it('fetches nothing while offline', async () => {
    reportOnline(false);
    setup();
    await settled();
    expect(warmed).toEqual([]);
  });

  it('fetches nothing while the page is hidden, and starts once it is visible', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    setup();
    await settled();
    expect(warmed).toEqual([]);

    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(warmed).toHaveLength(3));
  });

  it('fetches nothing with the emergency switch on', async () => {
    vi.stubEnv('NEXT_PUBLIC_SW_DISABLED', '1');
    setup();
    await settled();
    expect(warmed).toEqual([]);
  });

  it('fetches nothing while no service worker controls the page, and starts once one does', async () => {
    Object.defineProperty(navigator.serviceWorker, 'controller', { configurable: true, value: null, writable: true });
    setup();
    await settled();
    expect(warmed).toEqual([]);

    Object.defineProperty(navigator.serviceWorker, 'controller', { configurable: true, value: {} });
    act(() => swListeners.get('controllerchange')?.());
    await waitFor(() => expect(warmed).toHaveLength(3));
  });

  it('fetches nothing while the identity is still unknown', async () => {
    setup({ kind: 'pending' });
    await settled();
    expect(warmed).toEqual([]);
  });
});
