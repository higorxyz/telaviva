import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from './commands';
import { LibraryProvider } from './LibraryProvider';
import type { TvProgressInfo } from './progress';
import type { LibraryRepository } from './repository';
import { SeriesActions } from './SeriesActions';
import { EMPTY_LIBRARY, type LibraryState, type LibraryStatus, type TitleRef } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const tv = { id: 7, title: 'Série X', posterPath: '/p.jpg', releaseDate: '2020-01-01', genreIds: [18] };
const snapshot = { title: 'Série X', posterPath: '/p.jpg', releaseDate: '2020-01-01', genreIds: [18] };
const ref: TitleRef = { mediaType: 'tv', tmdbId: 7 };
const info: TvProgressInfo = {
  tvId: 7,
  ended: false,
  seasons: [{ seasonNumber: 1, episodeCount: 3 }],
  lastAired: { seasonNumber: 1, episodeNumber: 3 },
  nextToAir: null,
};

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
          <SeriesActions tv={tv} info={info} />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, applied };
}

const withStatus = (status: LibraryStatus): LibraryState =>
  applyCommand(EMPTY_LIBRARY, { type: 'setStatus', ref, status, snapshot, progress: info }, NOW);

const trigger = (name: string) => screen.getByRole('button', { name });
const option = (name: string) => screen.getByRole('button', { name });

describe('SeriesActions', () => {
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

  it('is disabled until the library loads', () => {
    setup(EMPTY_LIBRARY, { hold: true });
    expect(trigger('Adicionar à lista')).toBeDisabled();
  });

  it('offers "Adicionar à lista" for a title not in the library', async () => {
    setup();
    await waitFor(() => expect(trigger('Adicionar à lista')).toBeEnabled());
  });

  it.each([
    ['want', 'Quero ver'],
    ['watching', 'Assistindo'],
    ['watched', 'Assistido'],
  ] as const)('shows the %s status on the trigger', async (status, label) => {
    setup(withStatus(status));
    await waitFor(() => expect(trigger(label)).toBeEnabled());
  });

  it('adds to want with the toast and undo, then closes the panel', async () => {
    const { user, applied } = setup();
    await waitFor(() => expect(trigger('Adicionar à lista')).toBeEnabled());
    await user.click(trigger('Adicionar à lista'));
    expect(screen.getByRole('heading', { name: 'Status na sua lista' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover da lista' })).toBeNull();
    await user.click(option('Quero ver'));
    expect(applied).toEqual([{ type: 'setStatus', ref, status: 'want', snapshot, progress: info }]);
    expect(await screen.findByText('Salvo em Quero ver')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
    await waitFor(() => expect(trigger('Quero ver')).toHaveFocus());
  });

  it('marks the current status as pressed', async () => {
    const { user } = setup(withStatus('watching'));
    await waitFor(() => expect(trigger('Assistindo')).toBeEnabled());
    await user.click(trigger('Assistindo'));
    expect(screen.getByRole('button', { name: 'Assistindo', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quero ver', pressed: false })).toBeInTheDocument();
  });

  it('sends setStatus with progress for "Assistido", without a toast', async () => {
    const { user, applied } = setup(withStatus('watching'));
    await waitFor(() => expect(trigger('Assistindo')).toBeEnabled());
    await user.click(trigger('Assistindo'));
    await user.click(option('Assistido'));
    expect(applied).toEqual([{ type: 'setStatus', ref, status: 'watched', snapshot, progress: info }]);
    await waitFor(() => expect(trigger('Assistido')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });

  it('removes with the removal toast', async () => {
    const { user, applied } = setup(withStatus('want'));
    await waitFor(() => expect(trigger('Quero ver')).toBeEnabled());
    await user.click(trigger('Quero ver'));
    await user.click(option('Remover da lista'));
    expect(applied).toEqual([{ type: 'remove', ref }]);
    expect(await screen.findByText('Removido da sua lista')).toBeInTheDocument();
  });

  it('renders the rating control', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Dar nota para Série X' })).toBeInTheDocument();
  });
});
