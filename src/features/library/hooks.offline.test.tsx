import 'fake-indexeddb/auto';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import type { OfflineStore } from '../offline/store-types';
import { applyCommand, type LibraryCommand } from './commands';
import { LibraryProvider } from './LibraryProvider';
import { useLibraryActions, useLibraryEntry } from './hooks';
import { createOfflineAccountRepository } from './offline-repository';
import { createServerRepository } from './server-repository';
import { fakeLibraryServer, freshStore, queuedCommand, reportOnline, UID } from './test-library-server';
import { snap } from './test-storage';
import { EMPTY_LIBRARY, type TitleRef } from './types';
import { useQueueStatus } from './useQueueStatus';

const T0 = '2026-11-21T08:00:00.000Z';
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const setStatus = (status: 'want' | 'watched', ref = movie): LibraryCommand => ({
  type: 'setStatus',
  ref,
  status,
  snapshot: snap('Clube da Luta'),
});
const REJECTED = 'Uma ação feita sem internet não pôde ser salva.';
const EXPIRED = 'Algumas ações feitas sem internet há mais de 30 dias foram descartadas.';

let store: OfflineStore;
beforeEach(async () => {
  store = await freshStore();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

function setup() {
  const server = createServerRepository({ uid: UID, onUnauthenticated: async () => false });
  const repository = createOfflineAccountRepository({ server, store, uid: UID });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={repository}>{children}</LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
  return renderHook(
    () => ({ entry: useLibraryEntry(movie), actions: useLibraryActions(), status: useQueueStatus() }),
    { wrapper },
  );
}

describe('the account library offline', () => {
  it('undo of an action still queued takes it out of the queue and the list, without calling the server', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, setStatus('want'), T0));
    const { result } = setup();
    await waitFor(() => expect(result.current.entry.item?.status).toBe('want'));
    reportOnline(false);
    act(() => result.current.actions.run(setStatus('watched'), { undoable: { message: 'Movido para Assistidos' } }));
    await waitFor(() => expect(result.current.status.queued).toBe(1));
    expect(result.current.entry.item?.status).toBe('watched');
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(result.current.status.queued).toBe(0));
    expect(result.current.entry.item?.status).toBe('want');
    expect(await store.countQueue(UID)).toBe(0);
    expect(fake.received).toEqual([]);
  });

  it('undo of a queued action that was sent meanwhile puts the title back with a restore (Phase 3 path)', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, setStatus('want'), T0));
    const { result } = setup();
    await waitFor(() => expect(result.current.entry.item?.status).toBe('want'));
    reportOnline(false);
    act(() => result.current.actions.run(setStatus('watched'), { undoable: { message: 'Movido para Assistidos' } }));
    await waitFor(() => expect(result.current.status.queued).toBe(1));
    vi.restoreAllMocks();
    act(() => void window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(result.current.status.queued).toBe(0));
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(fake.received).toHaveLength(2));
    expect(fake.received[1]!.command).toMatchObject({ type: 'restore', ref: movie, item: { status: 'want' } });
    await waitFor(() => expect(result.current.entry.item?.status).toBe('want'));
  });

  it('counts the actions waiting, and back online sends them and counts down to zero', async () => {
    const fake = fakeLibraryServer();
    const { result } = setup();
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    reportOnline(false);
    act(() => result.current.actions.run(setStatus('want')));
    await waitFor(() => expect(result.current.status.queued).toBe(1));
    vi.restoreAllMocks();
    act(() => void window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(result.current.status.queued).toBe(0));
    expect(fake.received).toHaveLength(1);
    expect(result.current.entry.item?.status).toBe('want');
  });

  it('an action taken after the browser said `offline` is queued at once (TanStack Query must not hold it back)', async () => {
    const fake = fakeLibraryServer(applyCommand(EMPTY_LIBRARY, setStatus('want'), T0));
    const { result } = setup();
    await waitFor(() => expect(result.current.entry.item?.status).toBe('want'));
    reportOnline(false);
    // What the browser fires when the connection drops; TanStack Query's onlineManager listens to it.
    act(() => void window.dispatchEvent(new Event('offline')));
    act(() => result.current.actions.run(setStatus('watched')));
    await waitFor(() => expect(result.current.status.queued).toBe(1));
    expect(await store.countQueue(UID)).toBe(1);
    expect(result.current.entry.item?.status).toBe('watched');
    expect(fake.received).toEqual([]);
  });

  it('an action the server refuses on sync shows one toast, however many were refused', async () => {
    const fake = fakeLibraryServer();
    await store.enqueue(queuedCommand(setStatus('want'), T0));
    await store.enqueue(queuedCommand(setStatus('watched'), T0));
    fake.answerNext(400, 'stale');
    fake.answerNext(400, 'invalid');
    setup();
    expect(await screen.findByText(REJECTED)).toBeInTheDocument();
    await waitFor(async () => expect(await store.countQueue(UID)).toBe(0));
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(screen.getAllByText(REJECTED)).toHaveLength(1);
  });

  it('says so when actions older than 30 days were dropped unsent', async () => {
    fakeLibraryServer();
    await store.enqueue(queuedCommand(setStatus('want'), '2026-01-01T00:00:00.000Z'));
    setup();
    expect(await screen.findByText(EXPIRED)).toBeInTheDocument();
  });
});
