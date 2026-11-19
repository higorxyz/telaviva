import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from './commands';
import { LibraryProvider } from './LibraryProvider';
import { useLibraryActions, useLibraryEntry, useLibraryStatus } from './hooks';
import type { LibraryRepository } from './repository';
import { EMPTY_LIBRARY, type LibraryState, type TitleRef } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const snapshot = { title: 'Clube da Luta', posterPath: null, releaseDate: null, genreIds: [] };
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const setStatus = (status: 'want' | 'watched'): LibraryCommand => ({ type: 'setStatus', ref: movie, status, snapshot });
const ERROR_TEXT = 'Não foi possível salvar no navegador. Tente de novo.';

interface Pending {
  command: LibraryCommand;
  resolve: () => void;
  reject: (e: Error) => void;
}

/** Applies each command to its own state at call time, but resolves only when the test says so. */
function fakeRepository(opts: { persistent?: boolean; initial?: LibraryState } = {}) {
  let state = opts.initial ?? EMPTY_LIBRARY;
  const pending: Pending[] = [];
  const listeners = new Set<() => void>();
  const load = vi.fn(async () => state);
  const repository: LibraryRepository = {
    persistent: opts.persistent ?? true,
    load,
    apply: (command) =>
      new Promise<LibraryState>((resolve, reject) => {
        const before = state;
        const after = applyCommand(state, command, NOW);
        state = after;
        pending.push({
          command,
          resolve: () => resolve(after),
          reject: (e) => {
            state = before;
            reject(e);
          },
        });
      }),
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
  return {
    repository,
    load,
    pending,
    emit: () => listeners.forEach((l) => l()),
    setState: (next: LibraryState) => {
      state = next;
    },
  };
}

function setup(fake = fakeRepository()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={fake.repository}>{children}</LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
  return { client, wrapper, fake };
}

function useAll() {
  return { entry: useLibraryEntry(movie), actions: useLibraryActions() };
}

describe('useLibraryEntry', () => {
  it('starts not ready and then reflects the state', async () => {
    const fake = fakeRepository({ initial: applyCommand(EMPTY_LIBRARY, setStatus('want'), NOW) });
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useLibraryEntry(movie), { wrapper });
    expect(result.current).toEqual({ ready: false, item: null, rating: null, marks: [] });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.item?.status).toBe('want');
  });
});

describe('useLibraryStatus', () => {
  it('reports readiness and ignores other titles changing', async () => {
    const other: TitleRef = { mediaType: 'movie', tmdbId: 9 };
    const fake = fakeRepository({ initial: applyCommand(EMPTY_LIBRARY, setStatus('want'), NOW) });
    const { wrapper } = setup(fake);
    const { result } = renderHook(
      () => ({ status: useLibraryStatus(movie), actions: useLibraryActions() }),
      { wrapper },
    );
    expect(result.current.status).toEqual({ ready: false, status: null });
    await waitFor(() => expect(result.current.status).toEqual({ ready: true, status: 'want' }));
    act(() => result.current.actions.run({ type: 'setStatus', ref: other, status: 'want', snapshot }));
    await waitFor(() => expect(fake.pending).toHaveLength(1));
    await act(async () => fake.pending[0]!.resolve());
    expect(result.current.status).toEqual({ ready: true, status: 'want' });
  });
});

describe('useLibraryActions', () => {
  it('updates the cache before apply resolves (optimistic)', async () => {
    const { wrapper, fake } = setup();
    const { result } = renderHook(useAll, { wrapper });
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    act(() => result.current.actions.run(setStatus('want')));
    await waitFor(() => expect(result.current.entry.item?.status).toBe('want'));
    expect(fake.pending).toHaveLength(1);
  });

  it('rolls back and shows the error toast when apply rejects', async () => {
    const { wrapper, fake } = setup();
    const { result } = renderHook(useAll, { wrapper });
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    act(() => result.current.actions.run(setStatus('want')));
    await waitFor(() => expect(result.current.entry.item?.status).toBe('want'));
    await act(async () => fake.pending[0]!.reject(new Error('cheio')));
    await waitFor(() => expect(result.current.entry.item).toBeNull());
    expect(screen.getByText(ERROR_TEXT).closest('[data-toast]')).toHaveAttribute('data-tone', 'error');
  });

  it('keeps the second command as the final state when applies resolve out of order', async () => {
    const { wrapper, fake } = setup();
    const seen: (string | undefined)[] = [];
    const { result } = renderHook(
      () => {
        const all = useAll();
        seen.push(all.entry.item?.status);
        return all;
      },
      { wrapper },
    );
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    act(() => result.current.actions.run(setStatus('want')));
    act(() => result.current.actions.run(setStatus('watched')));
    await waitFor(() => expect(fake.pending).toHaveLength(2));
    await act(async () => fake.pending[1]!.resolve());
    await act(async () => fake.pending[0]!.resolve());
    await waitFor(() => expect(result.current.entry.item?.status).toBe('watched'));
    // And it stays that way after the final reload.
    await act(async () => {});
    expect(result.current.entry.item?.status).toBe('watched');
    // No stale value ever shows after the newer one.
    expect(seen.slice(seen.indexOf('watched'))).not.toContain('want');
    expect(seen.slice(seen.indexOf('watched'))).not.toContain(undefined);
  });

  it('offers Desfazer, which restores the previous item', async () => {
    const initial = applyCommand(EMPTY_LIBRARY, setStatus('want'), NOW);
    const { wrapper, fake } = setup(fakeRepository({ initial }));
    const { result } = renderHook(useAll, { wrapper });
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    act(() =>
      result.current.actions.run({ type: 'remove', ref: movie }, { undoable: { message: 'Removido da sua lista' } }),
    );
    await waitFor(() => expect(result.current.entry.item).toBeNull());
    await act(async () => fake.pending[0]!.resolve());
    expect(await screen.findByText('Removido da sua lista')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(fake.pending).toHaveLength(2));
    expect(fake.pending[1]!.command.type).toBe('restore');
    await waitFor(() => expect(result.current.entry.item?.status).toBe('want'));
    await act(async () => fake.pending[1]!.resolve());
    await waitFor(() => expect(result.current.entry.item?.status).toBe('want'));
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument();
  });
});

describe('LibraryProvider', () => {
  it('invalidates and reloads when the repository notifies a change', async () => {
    const { wrapper, fake } = setup();
    const { result } = renderHook(useAll, { wrapper });
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    expect(fake.load).toHaveBeenCalledTimes(1);
    fake.setState(applyCommand(EMPTY_LIBRARY, setStatus('watched'), NOW));
    act(() => fake.emit());
    await waitFor(() => expect(result.current.entry.item?.status).toBe('watched'));
    expect(fake.load).toHaveBeenCalledTimes(2);
  });

  it('warns once when storage is not persistent', async () => {
    const { wrapper } = setup(fakeRepository({ persistent: false }));
    const { rerender } = render(<div />, { wrapper });
    const message = 'Seu navegador está bloqueando o armazenamento. A lista vale só até fechar a aba.';
    expect(await screen.findByText(message)).toBeInTheDocument();
    rerender(<span />);
    expect(screen.getAllByText(message)).toHaveLength(1);
  });

  it('does not warn when storage is persistent', async () => {
    const { wrapper } = setup();
    render(<div />, { wrapper });
    await act(async () => {});
    expect(screen.queryByText(/bloqueando o armazenamento/)).not.toBeInTheDocument();
  });
});
