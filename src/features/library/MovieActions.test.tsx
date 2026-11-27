import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from './commands';
import { LibraryProvider } from './LibraryProvider';
import { MovieActions } from './MovieActions';
import type { LibraryRepository } from './repository';
import { EMPTY_LIBRARY, type LibraryState, type TitleRef } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const movie = { id: 550, title: 'Clube da Luta', posterPath: '/p.jpg', releaseDate: '1999-10-15', genreIds: [18] };
const snapshot = { title: 'Clube da Luta', posterPath: '/p.jpg', releaseDate: '1999-10-15', genreIds: [18] };
const ref: TitleRef = { mediaType: 'movie', tmdbId: 550 };

function setup(initial: LibraryState = EMPTY_LIBRARY, opts: { hold?: boolean } = {}) {
  let state = initial;
  const applied: LibraryCommand[] = [];
  const repository: LibraryRepository = {
    persistent: true,
    load: opts.hold ? () => new Promise<LibraryState>(() => {}) : async () => state,
    apply: async (command) => {
      applied.push(command);
      state = applyCommand(state, command, NOW);
      return state;
    },
    subscribe: () => () => {},
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={repository}>
          <MovieActions movie={movie} />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, applied };
}

const withStatus = (status: 'want' | 'watched'): LibraryState =>
  applyCommand(EMPTY_LIBRARY, { type: 'setStatus', ref, status, snapshot }, NOW);

const want = () => screen.getByRole('button', { name: 'Quero ver' });
const watched = () => screen.getByRole('button', { name: 'Já assisti' });

describe('MovieActions', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = function show() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  });
  beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is disabled and unpressed until the library loads', () => {
    setup(EMPTY_LIBRARY, { hold: true });
    expect(want()).toBeDisabled();
    expect(watched()).toBeDisabled();
    expect(want()).toHaveAttribute('aria-pressed', 'false');
    expect(watched()).toHaveAttribute('aria-pressed', 'false');
  });

  it('is enabled and unpressed for a title not in the library', async () => {
    setup();
    await waitFor(() => expect(want()).toBeEnabled());
    expect(want()).toHaveAttribute('aria-pressed', 'false');
    expect(watched()).toHaveAttribute('aria-pressed', 'false');
  });

  it('presses "Quero ver" for a want item', async () => {
    setup(withStatus('want'));
    await waitFor(() => expect(want()).toHaveAttribute('aria-pressed', 'true'));
    expect(watched()).toHaveAttribute('aria-pressed', 'false');
  });

  it('presses "Já assisti" for a watched item', async () => {
    setup(withStatus('watched'));
    await waitFor(() => expect(watched()).toHaveAttribute('aria-pressed', 'true'));
    expect(want()).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds to want with the toast and undo', async () => {
    const { user, applied } = setup();
    await waitFor(() => expect(want()).toBeEnabled());
    await user.click(want());
    expect(applied).toEqual([{ type: 'setStatus', ref, status: 'want', snapshot }]);
    expect(await screen.findByText('Salvo em Quero ver')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
    await waitFor(() => expect(want()).toHaveAttribute('aria-pressed', 'true'));
  });

  it('removes a want item with the removal toast', async () => {
    const { user, applied } = setup(withStatus('want'));
    await waitFor(() => expect(want()).toHaveAttribute('aria-pressed', 'true'));
    await user.click(want());
    expect(applied).toEqual([{ type: 'remove', ref }]);
    expect(await screen.findByText('Removido da sua lista')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
  });

  it('moves a watched item back to want', async () => {
    const { user, applied } = setup(withStatus('watched'));
    await waitFor(() => expect(watched()).toHaveAttribute('aria-pressed', 'true'));
    await user.click(want());
    expect(applied).toEqual([{ type: 'setStatus', ref, status: 'want', snapshot }]);
    expect(await screen.findByText('Salvo em Quero ver')).toBeInTheDocument();
  });

  it('marks "Já assisti" without a toast', async () => {
    const { user, applied } = setup();
    await waitFor(() => expect(watched()).toBeEnabled());
    await user.click(watched());
    expect(applied).toEqual([{ type: 'setStatus', ref, status: 'watched', snapshot }]);
    await waitFor(() => expect(watched()).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });

  it('un-marks "Já assisti" by removing, with the removal toast', async () => {
    const { user, applied } = setup(withStatus('watched'));
    await waitFor(() => expect(watched()).toHaveAttribute('aria-pressed', 'true'));
    await user.click(watched());
    expect(applied).toEqual([{ type: 'remove', ref }]);
    expect(await screen.findByText('Removido da sua lista')).toBeInTheDocument();
  });

  it('renders the rating control beside the buttons', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' })).toBeInTheDocument();
  });
});
