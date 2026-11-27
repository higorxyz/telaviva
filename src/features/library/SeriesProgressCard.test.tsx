import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/format';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from './commands';
import { LibraryProvider } from './LibraryProvider';
import type { TvProgressInfo } from './progress';
import type { LibraryRepository } from './repository';
import { SeriesProgressCard } from './SeriesProgressCard';
import { EMPTY_LIBRARY, type LibraryState } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const snapshot = { title: 'Série X', posterPath: null, releaseDate: '2020-01-01', genreIds: [] };
const info: TvProgressInfo = {
  tvId: 7,
  ended: false,
  seasons: [{ seasonNumber: 1, episodeCount: 24 }],
  lastAired: { seasonNumber: 1, episodeNumber: 24 },
  nextToAir: null,
};

const marked = (count: number): LibraryState => ({
  ...EMPTY_LIBRARY,
  episodes: Array.from({ length: count }, (_, i) => ({
    tvId: 7,
    seasonNumber: 1,
    episodeNumber: i + 1,
    watchedAt: NOW,
  })),
});

function season(names: Record<number, string>) {
  server.use(
    http.get(`${window.location.origin}/api/tv/7/season/1`, () =>
      HttpResponse.json({
        seasonNumber: 1,
        name: 'Temporada 1',
        overview: '',
        episodes: Object.entries(names).map(([n, name]) => ({
          seasonNumber: 1,
          episodeNumber: Number(n),
          name,
          overview: '',
          airDate: null,
          stillPath: null,
          runtime: null,
          voteAverage: 0,
        })),
      }),
    ),
  );
}

function setup(
  initial: LibraryState,
  cardInfo: TvProgressInfo = info,
  opts: { hold?: boolean } = {},
) {
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
          <SeriesProgressCard tvId={7} info={cardInfo} snapshot={snapshot} />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, applied };
}

describe('SeriesProgressCard', () => {
  it('labels the region with a unique id per instance', async () => {
    season({});
    const state = marked(5);
    const repository: LibraryRepository = {
      persistent: true,
      load: async () => state,
      apply: async () => state,
      subscribe: () => () => {},
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <LibraryProvider repository={repository}>
            <SeriesProgressCard tvId={7} info={info} snapshot={snapshot} />
            <SeriesProgressCard tvId={7} info={info} snapshot={snapshot} />
          </LibraryProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    const regions = await screen.findAllByRole('region', { name: 'Seu progresso' });
    expect(regions).toHaveLength(2);
    expect(regions[0].getAttribute('aria-labelledby')).not.toBe(regions[1].getAttribute('aria-labelledby'));
  });

  it('renders nothing before the library loads', () => {
    season({});
    setup(marked(5), info, { hold: true });
    expect(screen.queryByRole('region', { name: 'Seu progresso' })).toBeNull();
  });

  it('renders nothing when the series was not started', async () => {
    season({});
    setup(EMPTY_LIBRARY);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('region', { name: 'Seu progresso' })).toBeNull();
  });

  it('shows the next episode, the bar and the count while in progress', async () => {
    season({});
    setup(marked(5));
    expect(await screen.findByRole('region', { name: 'Seu progresso' })).toBeInTheDocument();
    expect(screen.getByText(/Próximo: T1E6/)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '5');
    expect(bar).toHaveAttribute('aria-valuemax', '24');
    expect(screen.getByText('5 de 24 episódios')).toBeInTheDocument();
  });

  it('adds the episode name once the season resolves', async () => {
    season({ 6: 'A Queda' });
    setup(marked(5));
    expect(await screen.findByText(/Próximo: T1E6 · A Queda/)).toBeInTheDocument();
  });

  it('works when the season request fails', async () => {
    server.use(http.get(`${window.location.origin}/api/tv/7/season/1`, () => new HttpResponse(null, { status: 500 })));
    setup(marked(5));
    expect(await screen.findByText(/Próximo: T1E6/)).toBeInTheDocument();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('marks the next episode as watched', async () => {
    season({});
    const { user, applied } = setup(marked(5));
    await user.click(await screen.findByRole('button', { name: 'Marcar como visto' }));
    expect(applied).toEqual([
      {
        type: 'setEpisodes',
        tvId: 7,
        marks: [{ seasonNumber: 1, episodeNumber: 6 }],
        watched: true,
        snapshot,
        progress: info,
      },
    ]);
    await waitFor(() => expect(screen.getByText('6 de 24 episódios')).toBeInTheDocument());
  });

  it('says "Em dia" with the next air date when caught up', async () => {
    const caughtUp: TvProgressInfo = { ...info, nextToAir: { seasonNumber: 2, episodeNumber: 1, airDate: '2026-12-25' } };
    setup(marked(24), caughtUp);
    expect(await screen.findByText('Em dia')).toBeInTheDocument();
    expect(screen.getByText(`Próximo episódio em ${formatDate('2026-12-25')}`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Marcar como visto' })).toBeNull();
  });

  it('says "Em dia" without a date when none is known', async () => {
    setup(marked(24));
    expect(await screen.findByText('Em dia')).toBeInTheDocument();
    expect(screen.queryByText(/Próximo episódio em/)).toBeNull();
  });

  it('says "Série concluída" when finished', async () => {
    setup(marked(24), { ...info, ended: true });
    expect(await screen.findByText('Série concluída')).toBeInTheDocument();
  });
});
