import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from './commands';
import { LIBRARY_KEY, LibraryProvider } from './LibraryProvider';
import { useLibraryActions, useLibraryEntry } from './hooks';
import type { TitlePreImage } from './pre-image';
import type { AppliedCommand, LibraryRepository } from './repository';
import { EMPTY_LIBRARY, type LibraryState, type TitleRef } from './types';

const T0 = '2026-11-19T10:00:00.000Z';
const NOW = '2026-11-19T12:00:00.000Z';
const snapshot = { title: 'Clube da Luta', posterPath: null, releaseDate: null, genreIds: [] };
const movie: TitleRef = { mediaType: 'movie', tmdbId: 550 };
const other: TitleRef = { mediaType: 'movie', tmdbId: 13 };
const setStatus = (status: 'want' | 'watched', ref = movie): LibraryCommand => ({ type: 'setStatus', ref, status, snapshot });

type Pending = { command: LibraryCommand; resolve: (answer?: Partial<AppliedCommand>) => void };

/** The account repository as the hooks see it: each apply answers the stored list and the title's pre-image. */
function serverLike(initial: LibraryState) {
  let stored = initial;
  const pending: Pending[] = [];
  const load = vi.fn(async () => stored);
  const repository: LibraryRepository = {
    persistent: true,
    remote: true,
    load,
    apply: () => Promise.reject(new Error('the hooks use applyWithPreImage')),
    applyWithPreImage: (command) =>
      new Promise<AppliedCommand>((resolve) => {
        const previousState = stored;
        stored = applyCommand(stored, command, NOW);
        const state = stored;
        pending.push({
          command,
          resolve: (answer) => {
            const item = previousState.items[0] ?? null;
            resolve({ state, previous: { item, rating: null, marks: [] }, ...answer });
          },
        });
      }),
    subscribe: () => () => {},
  };
  return { repository, pending, load, setStored: (next: LibraryState) => (stored = next) };
}

function setup(fake: ReturnType<typeof serverLike>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={fake.repository}>{children}</LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
  const view = renderHook(() => ({ entry: useLibraryEntry(movie), actions: useLibraryActions() }), { wrapper });
  return { client, ...view };
}

describe('useLibraryActions with the account repository', () => {
  it('builds the undo from the pre-image the server answered, not from what this tab had cached', async () => {
    const cached = applyCommand(EMPTY_LIBRARY, setStatus('want'), T0);
    const fake = serverLike(cached);
    const { result } = setup(fake);
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    act(() => result.current.actions.run({ type: 'remove', ref: movie }, { undoable: { message: 'Removido da sua lista' } }));
    await waitFor(() => expect(fake.pending).toHaveLength(1));
    // Another device had marked it watched; the server saw that state right before removing it.
    const watchedElsewhere = applyCommand(cached, setStatus('watched'), '2026-11-19T11:00:00.000Z').items[0]!;
    const previous: TitlePreImage = { item: watchedElsewhere, rating: null, marks: [] };
    await act(async () => fake.pending[0]!.resolve({ previous }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(fake.pending).toHaveLength(2));
    expect(fake.pending[1]!.command).toMatchObject({ type: 'restore', ref: movie, item: { status: 'watched' } });
  });

  it('offers no undo when the server sent no readable pre-image', async () => {
    const fake = serverLike(applyCommand(EMPTY_LIBRARY, setStatus('want'), T0));
    const { result } = setup(fake);
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    act(() => result.current.actions.run({ type: 'remove', ref: movie }, { undoable: { message: 'Removido da sua lista' } }));
    await waitFor(() => expect(fake.pending).toHaveLength(1));
    await act(async () => fake.pending[0]!.resolve({ previous: null }));
    await waitFor(() => expect(result.current.entry.item).toBeNull());
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });

  it('after the last mutation settles, takes the list the POST answered instead of loading it again', async () => {
    const fake = serverLike(EMPTY_LIBRARY);
    const { result, client } = setup(fake);
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    expect(fake.load).toHaveBeenCalledTimes(1);
    act(() => result.current.actions.run(setStatus('want')));
    await waitFor(() => expect(fake.pending).toHaveLength(1));
    // The server also holds a change from another device, which the answer carries.
    const answer = applyCommand(applyCommand(EMPTY_LIBRARY, setStatus('want'), NOW), setStatus('watched', other), NOW);
    await act(async () => fake.pending[0]!.resolve({ state: answer }));
    await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(fake.load).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(LIBRARY_KEY)).toEqual(answer);
  });

  it('loads again when mutations overlapped (an answer may predate another write)', async () => {
    const fake = serverLike(EMPTY_LIBRARY);
    const { result } = setup(fake);
    await waitFor(() => expect(result.current.entry.ready).toBe(true));
    act(() => result.current.actions.run(setStatus('want')));
    act(() => result.current.actions.run(setStatus('want', other)));
    await waitFor(() => expect(fake.pending).toHaveLength(2));
    await act(async () => fake.pending[1]!.resolve());
    await act(async () => fake.pending[0]!.resolve());
    await waitFor(() => expect(fake.load).toHaveBeenCalledTimes(2));
  });
});
