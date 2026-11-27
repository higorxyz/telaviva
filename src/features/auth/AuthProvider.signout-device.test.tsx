import 'fake-indexeddb/auto';
import { act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '@/features/library/commands';
import { useLibrary } from '@/features/library/hooks';
import type { TvProgressInfo } from '@/features/library/progress';
import { freshStore, reportOnline } from '@/features/library/test-library-server';
import { snap } from '@/features/library/test-storage';
import { EMPTY_LIBRARY } from '@/features/library/types';
import { useTvProgress } from '@/features/library/view/useTvProgress';
import { clearLeaving } from '@/features/offline/leaving';
import type { OfflineStore } from '@/features/offline/store-types';
import { WarmWatching } from '@/features/offline/useWarmWatching';
import { server } from '@/test/server';
import { resetFirebaseClient } from './firebase-client';
import { accounts, auth as holder, clearCookies, installDefaultApi, probe, renderAuth, signedInOnServer, url } from './test-auth';
import { authConfig, fakeAuth, fakeUser, log, resetFakeFirebase } from './test-firebase';

vi.mock('firebase/app', async () => (await import('./test-firebase')).fakeAppModule);
vi.mock('firebase/auth', async () => (await import('./test-firebase')).fakeAuthModule);
vi.mock('@/lib/auth-config', async () => (await import('./test-firebase')).fakeAuthConfigModule);

const auth = () => holder.current!;
const info: TvProgressInfo = {
  tvId: 5,
  ended: false,
  seasons: [{ seasonNumber: 1, episodeCount: 4 }],
  lastAired: { seasonNumber: 1, episodeNumber: 4 },
  nextToAir: null,
};
const watching = applyCommand(
  EMPTY_LIBRARY,
  { type: 'setStatus', ref: { mediaType: 'tv', tmdbId: 5 }, status: 'watching', snapshot: snap('Ruptura') },
  '2026-11-21T10:00:00.000Z',
);

/** A request that waits for the returned `release()`; `sent()` says whether it went out. */
function held(method: 'get' | 'delete', path: string, answer: () => Response) {
  let release = () => {};
  let wasSent = false;
  const gate = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http[method](url(path), async () => {
      wasSent = true;
      if (method === 'delete') log.push('DELETE session');
      await gate;
      return answer();
    }),
  );
  return { release: () => release(), sent: () => wasSent };
}

/** Asks the progress of the series in the library, as the home rail does: only once the account's list loaded. */
function Progress() {
  const { state } = useLibrary();
  useTvProgress(state?.items.map((item) => item.tmdbId) ?? []);
  return null;
}

let store: OfflineStore;
beforeEach(async () => {
  resetFakeFirebase();
  resetFirebaseClient();
  authConfig.enabled = true;
  installDefaultApi();
  store = await freshStore();
});
afterEach(() => {
  clearLeaving('u1');
  clearCookies();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

async function signedIn(extra: ReactNode) {
  accounts.set('u1', watching);
  signedInOnServer('u1');
  fakeAuth.currentUser = fakeUser('u1');
  renderAuth(extra);
  await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
}

/** "Sair", held at its DELETE (after the wipe); `release` lets the late answer land, then the DELETE. */
async function signOutWhile(late: { release: () => void }) {
  const deletion = held('delete', '/api/auth/session', () => new HttpResponse(null, { status: 204 }));
  let leaving: Promise<void> = Promise.resolve();
  act(() => {
    leaving = auth().signOut();
  });
  await waitFor(() => expect(deletion.sent()).toBe(true));
  late.release();
  await act(() => new Promise((r) => setTimeout(r, 150)));
  deletion.release();
  await act(() => leaving);
  expect(probe()).toMatch(/^guest/);
}

describe('AuthProvider: "Sair" with background work for the account still running', () => {
  it('a series progress answer landing during the DELETE keeps nothing of the account on the device', async () => {
    const progress = held('get', '/api/tv/progress', () => HttpResponse.json({ 5: info }));
    await signedIn(<Progress />);
    await waitFor(() => expect(progress.sent()).toBe(true));
    await signOutWhile(progress);
    expect(await store.getMeta('progress:u1')).toBeUndefined();
  });

  it('a warm-up finishing a series during the DELETE keeps nothing of the account on the device', async () => {
    server.use(http.get(url('/api/tv/progress'), () => HttpResponse.json({ 5: info })));
    server.use(http.get(url('/api/tv/5/season/:n'), () => HttpResponse.json({ episodes: [] })));
    const page = held('get', '/serie/5-ruptura', () => new HttpResponse('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }));
    reportOnline(true);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: {}, addEventListener: () => {}, removeEventListener: () => {} },
    });
    await signedIn(<WarmWatching />);
    await waitFor(() => expect(page.sent()).toBe(true));
    await signOutWhile(page);
    expect(await store.getMeta('warm:u1')).toBeUndefined();
  });

  it('keeps the account’s progress again once it signs in again', async () => {
    server.use(http.get(url('/api/tv/progress'), () => HttpResponse.json({ 5: info })));
    await signedIn(<Progress />);
    await act(() => auth().signOut());
    expect(probe()).toMatch(/^guest/);

    await act(async () => auth().signInWithEmail('u1@exemplo.com', 'segredo123'));
    await waitFor(() => expect(probe()).toBe('signed-in|u1|1'));
    await waitFor(async () => expect(await store.getMeta('progress:u1')).toEqual([info]));
  });
});
