import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand } from './commands';
import { useLibrary, useLibraryActions } from './hooks';
import { useRecommendations } from './useRecommendations';
import { entry, stateOf } from './view/test-state';
import { LibraryProvider, type LibraryMode } from './LibraryProvider';
import { createLocalRepository } from './local-repository';
import type { LibraryNotice, LibraryRepository } from './repository';
import { item, KEY, memStorage, want } from './test-storage';
import { EMPTY_LIBRARY } from './types';

const RECOVERED = 'Recuperamos sua lista, mas alguns itens estavam corrompidos.';

function renderWith(repository: LibraryRepository) {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={repository}>
          <span>conteúdo</span>
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('LibraryProvider notices', () => {
  it('shows the recovery toast once, however many times the repository reports it', () => {
    let emit: (notice: LibraryNotice) => void = () => {};
    renderWith({
      persistent: true,
      load: async () => EMPTY_LIBRARY,
      apply: async () => EMPTY_LIBRARY,
      subscribe: () => () => {},
      onNotice: (listener) => {
        emit = listener;
        return () => {};
      },
    });
    act(() => emit('recovered'));
    act(() => emit('recovered'));
    expect(screen.getAllByText(RECOVERED)).toHaveLength(1);
  });

  it('shows it for a real local library whose rows were partly corrupt, loaded before the provider listened', async () => {
    const raw = JSON.stringify({ version: 1, items: [item(1), { broken: true }], episodes: [], ratings: [] });
    const repository = createLocalRepository({ storage: memStorage({ [KEY]: raw }).storage });
    await repository.load();
    renderWith(repository);
    expect(await screen.findByText(RECOVERED)).toBeInTheDocument();
  });

  it('repeats conflict and limit toasts, but not within two seconds', () => {
    let emit: (notice: LibraryNotice) => void = () => {};
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
    renderWith({
      persistent: true,
      load: async () => EMPTY_LIBRARY,
      apply: async () => EMPTY_LIBRARY,
      subscribe: () => () => {},
      onNotice: (listener) => {
        emit = listener;
        return () => {};
      },
    });
    const LIMIT = 'Sua lista chegou ao limite de itens.';
    act(() => emit('limit'));
    act(() => emit('limit'));
    expect(screen.getAllByText(LIMIT)).toHaveLength(1);
    act(() => void vi.setSystemTime(new Date('2026-11-20T10:00:03Z')));
    act(() => emit('limit'));
    expect(screen.getAllByText(LIMIT)).toHaveLength(2);
    vi.useRealTimers();
  });
});

describe('LibraryProvider modes', () => {
  const url = (path: string) => `${window.location.origin}${path}`;
  const serverState = { ...EMPTY_LIBRARY, items: [item(7)] };

  function Probe() {
    const { state, ready } = useLibrary();
    return <span>{ready ? `itens:${state?.items.length}` : 'carregando'}</span>;
  }

  function tree(mode: LibraryMode, client: QueryClient) {
    return (
      <QueryClientProvider client={client}>
        <ToastProvider>
          <LibraryProvider mode={mode}>
            <Probe />
          </LibraryProvider>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  afterEach(() => window.localStorage.clear());

  it('switches from guest to account: new repository, identity queries cleared, no cross-identity flash', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, items: [item(1), item(2)], episodes: [], ratings: [] }));
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(url('/api/library'), async () => {
        await gate;
        return HttpResponse.json(serverState);
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(tree({ kind: 'guest' }, client));
    expect(await screen.findByText('itens:2')).toBeInTheDocument();
    client.setQueryData(['recommendations', 'h'], ['x']);
    client.setQueryData(['tv-progress', 1], {});

    rerender(tree({ kind: 'account', uid: 'u1' }, client));
    expect(screen.queryByText('itens:2')).toBeNull();
    expect(client.getQueryData(['recommendations', 'h'])).toBeUndefined();
    expect(client.getQueryData(['tv-progress', 1])).toBeUndefined();
    expect(screen.getByText('carregando')).toBeInTheDocument();
    release();
    expect(await screen.findByText('itens:1')).toBeInTheDocument();
  });

  it('shows only the conflict toast when the account repository reports a conflict', async () => {
    server.use(
      http.get(url('/api/library'), () => HttpResponse.json(EMPTY_LIBRARY)),
      http.post(url('/api/library/commands'), () => HttpResponse.json({ error: 'conflict' }, { status: 409 })),
    );
    function Run() {
      const { run } = useLibraryActions();
      return <button onClick={() => run(want(1))}>go</button>;
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <LibraryProvider mode={{ kind: 'account', uid: 'u1' }}>
            <Probe />
            <Run />
          </LibraryProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    await screen.findByText('itens:0');
    fireEvent.click(screen.getByText('go'));
    expect(await screen.findByText('A lista mudou em outro aparelho.')).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível salvar/)).toBeNull();
  });

  describe('identity isolation', () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const watched = (id: number) => entry('movie', id, 'watched', { title: `T${id}` });
    const accountState = stateOf({ items: [watched(10), watched(11)] });

    function gate() {
      let open: () => void = () => {};
      const promise = new Promise<void>((resolve) => (open = resolve));
      return { promise, open };
    }

    function Harness({ undoable }: { undoable?: boolean }) {
      const { run } = useLibraryActions();
      return (
        <>
          <Probe />
          <button onClick={() => run(want(1), undoable ? { undoable: { message: 'Salvo' } } : undefined)}>go</button>
        </>
      );
    }

    function setupSwitch(undoable = false) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const view = (mode: LibraryMode) => (
        <QueryClientProvider client={client}>
          <ToastProvider>
            <LibraryProvider mode={mode}>
              <Harness undoable={undoable} />
            </LibraryProvider>
          </ToastProvider>
        </QueryClientProvider>
      );
      return { client, view, ...render(view({ kind: 'account', uid: 'u1' })) };
    }

    it("never serves the previous identity's recommendations once the new one is ready", async () => {
      const guestGate = gate();
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ version: 1, items: [watched(20)], episodes: [], ratings: [] }),
      );
      server.use(
        http.get(url('/api/library'), () => HttpResponse.json(accountState)),
        http.post('*/api/recommendations', async ({ request }) => {
          const body = (await request.json()) as { seeds: { key?: string }[] };
          const isGuest = JSON.stringify(body).includes('"tmdbId":20') || JSON.stringify(body).includes('movie:20');
          if (isGuest) await guestGate.promise;
          return HttpResponse.json({ results: [{ id: isGuest ? 2 : 1, mediaType: 'movie', title: isGuest ? 'Guest' : 'Account' }] });
        }),
      );
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      let mode: LibraryMode = { kind: 'account', uid: 'u1' };
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>
          <ToastProvider>
            <LibraryProvider mode={mode}>{children}</LibraryProvider>
          </ToastProvider>
        </QueryClientProvider>
      );
      const seen: string[] = [];
      const { result, rerender } = renderHook(
        () => {
          const value = useRecommendations();
          seen.push(`${value.ready}:${value.items.map((i) => i.title).join(',')}`);
          return value;
        },
        { wrapper },
      );
      await waitFor(() => expect(result.current.items.map((i) => i.title)).toEqual(['Account']));
      seen.length = 0;
      mode = { kind: 'guest' };
      rerender();
      await act(async () => sleep(50));
      guestGate.open();
      await waitFor(() => expect(result.current.items.map((i) => i.title)).toEqual(['Guest']));
      expect(seen.filter((entry) => entry.startsWith('true:') && entry.includes('Account'))).toEqual([]);
    });

    it('drops a failing account apply that outlives the sign-out: no rollback into the guest cache, no toast', async () => {
      const applyGate = gate();
      server.use(
        http.get(url('/api/library'), () => HttpResponse.json(accountState)),
        http.post(url('/api/library/commands'), async () => {
          await applyGate.promise;
          return new HttpResponse(null, { status: 500 });
        }),
      );
      const { view, rerender } = setupSwitch();
      await screen.findByText('itens:2');
      fireEvent.click(screen.getByText('go'));
      await act(async () => sleep(20));
      rerender(view({ kind: 'guest' }));
      expect(await screen.findByText('itens:0')).toBeInTheDocument();
      applyGate.open();
      await act(async () => sleep(80));
      expect(screen.getByText('itens:0')).toBeInTheDocument();
      expect(screen.queryByText(/Não foi possível salvar/)).toBeNull();
    });

    it('does not let an account undo toast write into the guest library after the sign-out', async () => {
      server.use(
        http.get(url('/api/library'), () => HttpResponse.json(accountState)),
        http.post(url('/api/library/commands'), () =>
          HttpResponse.json(applyCommand(accountState, want(1), '2026-11-20T10:00:00.000Z')),
        ),
      );
      const { view, rerender } = setupSwitch(true);
      await screen.findByText('itens:2');
      fireEvent.click(screen.getByText('go'));
      await screen.findByText('Salvo');
      rerender(view({ kind: 'guest' }));
      await screen.findByText('itens:0');
      expect(screen.queryByText('Desfazer')).toBeNull();
      const undo = screen.queryByText('Desfazer');
      if (undo) fireEvent.click(undo);
      await act(async () => sleep(50));
      expect(window.localStorage.getItem(KEY)).toBeNull();
    });
  });
});
