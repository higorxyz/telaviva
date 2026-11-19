import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from '../commands';
import { LibraryProvider } from '../LibraryProvider';
import type { TvProgressInfo } from '../progress';
import type { LibraryRepository } from '../repository';
import type { LibraryState } from '../types';
import { LibraryView } from './LibraryView';
import { entry, mark, rating, stateOf } from './test-state';

const harness = { params: new URLSearchParams() };
vi.mock('next/navigation', () => ({ useSearchParams: () => harness.params }));

const NOW = '2026-11-19T12:00:00.000Z';
const info = (tvId: number, last: [number, number]): TvProgressInfo => ({
  tvId,
  ended: false,
  seasons: [{ seasonNumber: 2, episodeCount: 8 }, { seasonNumber: 1, episodeCount: 10 }].sort(
    (a, b) => a.seasonNumber - b.seasonNumber,
  ),
  lastAired: { seasonNumber: last[0], episodeNumber: last[1] },
  nextToAir: null,
});

function progress(map: Record<string, TvProgressInfo>) {
  server.use(http.get(`${window.location.origin}/api/tv/progress`, () => HttpResponse.json(map)));
}

function setup(initial: LibraryState, qs = '', opts: { hold?: boolean } = {}) {
  harness.params = new URLSearchParams(qs);
  let state = initial;
  const repository: LibraryRepository = {
    persistent: true,
    load: opts.hold ? () => new Promise<LibraryState>(() => {}) : async () => state,
    apply: async (command: LibraryCommand) => {
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
          <LibraryView />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user };
}

const sample = stateOf({
  items: [
    entry('movie', 1, 'want', { title: 'Matrix', releaseDate: '1999-03-31' }),
    entry('movie', 2, 'want', { title: 'Amelie', releaseDate: '2001-04-25' }),
    entry('tv', 3, 'watching', { title: 'Severance', releaseDate: '2022-02-18' }),
    entry('movie', 4, 'watched', { title: 'Duna', releaseDate: '2021-10-22' }),
  ],
  ratings: [rating('movie', 4, 9)],
  episodes: [mark(3, 1, 1)],
});

describe('LibraryView', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = function show() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.showModal = HTMLDialogElement.prototype.show;
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('shows a skeleton, not an empty state, until the library is ready', () => {
    setup(stateOf({}), '', { hold: true });
    expect(screen.queryByText('Sua lista está vazia')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('lists the tabs with counts and opens on Assistindo when a series is in progress', async () => {
    progress({});
    setup(sample);
    const tabs = await screen.findByRole('tablist');
    const [watching, want, watched] = within(tabs).getAllByRole('tab');
    expect(watching).toHaveTextContent('Assistindo · 1');
    expect(want).toHaveTextContent('Quero ver · 2');
    expect(watched).toHaveTextContent('Assistidos · 1');
    expect(watching).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toContainElement(screen.getByRole('link', { name: /Severance/ }));
  });

  it('opens on Quero ver without a series in progress and hides nothing else', async () => {
    setup(stateOf({ items: [entry('movie', 1, 'want', { title: 'Matrix' })] }));
    expect(await screen.findByRole('link', { name: /Matrix/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Quero ver/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('writes the tab to the URL with replaceState and moves with the arrow keys', async () => {
    progress({});
    const spy = vi.spyOn(window.history, 'replaceState');
    const { user } = setup(sample);
    await screen.findByRole('tablist');
    await user.click(screen.getByRole('tab', { name: /Assistidos/ }));
    expect(spy).toHaveBeenLastCalledWith(null, '', '/minha-lista?aba=assistidos');
    expect(screen.getByRole('link', { name: /Duna/ })).toBeInTheDocument();

    screen.getByRole('tab', { name: /Assistidos/ }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /Quero ver/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Quero ver/ })).toHaveFocus();
    expect(spy).toHaveBeenLastCalledWith(null, '', '/minha-lista?aba=quero-ver');
  });

  it('reads the tab, type and order from the URL', async () => {
    setup(sample, 'aba=quero-ver&tipo=filme&ordem=titulo');
    const links = await screen.findAllByRole('link', { name: /\(/ });
    expect(links.map((l) => l.getAttribute('aria-label'))).toEqual([
      expect.stringContaining('Amelie'),
      expect.stringContaining('Matrix'),
    ]);
    expect(screen.getByRole('button', { name: 'Filmes' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('titulo');
  });

  it('filters by type and hides the filter on Assistindo', async () => {
    progress({});
    const { user } = setup(sample, 'aba=quero-ver');
    await screen.findByRole('tablist');
    await user.click(screen.getByRole('button', { name: 'Séries' }));
    expect(screen.getByText('Sua lista está vazia')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Assistindo/ }));
    expect(screen.queryByRole('button', { name: 'Séries' })).toBeNull();
  });

  it('sorts by your score', async () => {
    const { user } = setup(sample, 'aba=quero-ver');
    await screen.findByRole('tablist');
    await user.selectOptions(screen.getByLabelText('Ordenar por'), 'nota');
    expect(window.location.search).toBe('?aba=quero-ver&ordem=nota');
    expect(screen.getByLabelText('Ordenar por')).toHaveValue('nota');
  });

  it('shows the next episode in Assistindo and "Em dia" when caught up', async () => {
    const state = stateOf({
      items: [entry('tv', 3, 'watching', { title: 'Severance' }), entry('tv', 5, 'watching', { title: 'Andor' })],
      episodes: [
        ...Array.from({ length: 10 }, (_, i) => mark(3, 1, i + 1)),
        ...Array.from({ length: 4 }, (_, i) => mark(3, 2, i + 1)),
        ...Array.from({ length: 10 }, (_, i) => mark(5, 1, i + 1)),
        ...Array.from({ length: 8 }, (_, i) => mark(5, 2, i + 1)),
      ],
    });
    progress({ '3': info(3, [2, 8]), '5': info(5, [2, 8]) });
    setup(state);
    expect(await screen.findByRole('link', { name: /Severance \(Próximo: T2E5\)/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Andor \(Em dia\)/ })).toBeInTheDocument();
  });

  it('flags a watched series that gained episodes', async () => {
    const state = stateOf({
      items: [entry('tv', 3, 'watched', { title: 'Severance', releaseDate: '2022-02-18' })],
      episodes: Array.from({ length: 10 }, (_, i) => mark(3, 1, i + 1)),
    });
    progress({ '3': info(3, [2, 3]) });
    setup(state, 'aba=assistidos');
    expect(await screen.findByRole('link', { name: /Severance \(Novos episódios\)/ })).toBeInTheDocument();
  });

  it('falls back to the year when the progress route fails', async () => {
    server.use(http.get(`${window.location.origin}/api/tv/progress`, () => HttpResponse.json({}, { status: 502 })));
    setup(
      stateOf({ items: [entry('tv', 3, 'watching', { title: 'Severance', releaseDate: '2022-02-18' })] }),
    );
    expect(await screen.findByRole('link', { name: /Severance \(2022\)/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('shows your score in the ring and the stats strip', async () => {
    progress({});
    setup(sample, 'aba=assistidos');
    await screen.findByRole('link', { name: /Duna/ });
    expect(screen.getByText('Média das suas notas')).toBeInTheDocument();
    expect(screen.getAllByText('9,0')).toHaveLength(2); // the ring and the average
  });

  it.each([
    ['assistindo', 'Nenhuma série em andamento'],
    ['quero-ver', 'Sua lista está vazia'],
    ['assistidos', 'Nada assistido ainda'],
  ])('shows the empty state of %s with a link to Descobrir', async (aba, title) => {
    setup(stateOf({ items: [entry('movie', 9, aba === 'quero-ver' ? 'watched' : 'want')] }), `aba=${aba}`);
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descobrir' })).toHaveAttribute('href', '/descobrir');
  });

  it('hides the stats strip when the library is empty', async () => {
    setup(stateOf({}));
    expect(await screen.findByText('Sua lista está vazia')).toBeInTheDocument();
    expect(screen.queryByText('Média das suas notas')).toBeNull();
  });
});
