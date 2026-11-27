import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '@/features/library/commands';
import { LibraryProvider } from '@/features/library/LibraryProvider';
import type { TvProgressInfo } from '@/features/library/progress';
import type { LibraryRepository } from '@/features/library/repository';
import type { LibraryState } from '@/features/library/types';
import { EMPTY_LIBRARY } from '@/features/library/types';
import { entry, mark, rating, stateOf } from '@/features/library/view/test-state';
import { server } from '@/test/server';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { LibraryRails } from './LibraryRails';

const info = (tvId: number, last: [number, number]): TvProgressInfo => ({
  tvId,
  ended: false,
  seasons: [
    { seasonNumber: 1, episodeCount: 10 },
    { seasonNumber: 2, episodeCount: 8 },
  ],
  lastAired: { seasonNumber: last[0], episodeNumber: last[1] },
  nextToAir: null,
});

function progress(map: Record<string, TvProgressInfo> | 'fail') {
  server.use(
    http.get(`${window.location.origin}/api/tv/progress`, () =>
      map === 'fail' ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(map),
    ),
  );
}

function recommendations(count: number | 'fail') {
  server.use(
    http.post('*/api/recommendations', () =>
      count === 'fail'
        ? HttpResponse.json({}, { status: 500 })
        : HttpResponse.json({
            results: Array.from({ length: count }, (_, i) => ({
              id: 900 + i,
              mediaType: 'movie',
              title: `Sugestao ${i}`,
              originalTitle: 'x',
              overview: '',
              posterPath: null,
              backdropPath: null,
              voteAverage: 7,
              voteCount: 1,
              popularity: 1,
              releaseDate: '2020-01-01',
              genreIds: [],
              originalLanguage: 'en',
            })),
          }),
    ),
  );
}

function setup(initial: LibraryState) {
  let state = initial;
  const repository: LibraryRepository = {
    persistent: true,
    load: async () => state,
    apply: async (command) => (state = applyCommand(state, command, new Date().toISOString())),
    subscribe: () => () => {},
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={repository}>
          <LibraryRails />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const watching = stateOf({
  items: [entry('tv', 3, 'watching', { title: 'Severance' })],
  episodes: [mark(3, 1, 1)],
  ratings: [rating('tv', 3, 9)],
});

describe('LibraryRails', () => {
  it('renders nothing for an empty library', async () => {
    recommendations(0);
    setup(EMPTY_LIBRARY);
    await settle();
    expect(screen.queryAllByRole('region')).toHaveLength(0);
    expect(document.querySelector('section')).toBeNull();
  });

  it('shows Continue assistindo with the next episode and the personal rating', async () => {
    progress({ '3': info(3, [2, 8]) });
    recommendations(0);
    setup(watching);
    const region = await screen.findByRole('region', { name: 'Continue assistindo' });
    await waitFor(() => expect(region).toHaveTextContent('Próximo: T1E2'));
    expect(region).toHaveTextContent('Severance');
    expect(region.querySelector('[aria-label="Sua nota 9,0 de 10"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Ver tudo: Continue assistindo' })).toHaveAttribute(
      'href',
      '/minha-lista?aba=assistindo',
    );
  });

  it('leaves out a caught-up series, so the rail is hidden', async () => {
    progress({ '3': info(3, [1, 1]) });
    recommendations(0);
    setup(watching);
    await settle();
    expect(screen.queryByRole('region', { name: 'Continue assistindo' })).not.toBeInTheDocument();
  });

  it('orders by the latest activity: marking an episode bumps the series to the front', async () => {
    progress({ '3': info(3, [2, 8]), '4': info(4, [2, 8]) });
    recommendations(0);
    const base = stateOf({
      items: [
        entry('tv', 3, 'watching', { title: 'Antiga', updatedAt: '2026-11-02T00:00:00.000Z' }),
        entry('tv', 4, 'watching', { title: 'Recente', updatedAt: '2026-11-03T00:00:00.000Z' }),
      ],
      episodes: [mark(3, 1, 1), mark(4, 1, 1)],
    });
    // The reducer is the only writer: an episode mark always refreshes the series' updatedAt.
    const snapshot = { title: 'Antiga', posterPath: null, releaseDate: null, genreIds: [] };
    const marked = applyCommand(
      base,
      { type: 'setEpisodes', tvId: 3, marks: [{ seasonNumber: 1, episodeNumber: 2 }], watched: true, snapshot, progress: info(3, [2, 8]) },
      '2026-11-10T00:00:00.000Z',
    );
    setup(marked);
    const region = await screen.findByRole('region', { name: 'Continue assistindo' });
    const names = () => Array.from(region.querySelectorAll('li a')).map((a) => a.getAttribute('aria-label') ?? '');
    await waitFor(() => expect(names()).toHaveLength(2));
    expect(names()[0]).toMatch(/^Antiga/);
    expect(names()[1]).toMatch(/^Recente/);
  });

  it('hides Continue assistindo without error when progress fails', async () => {
    progress('fail');
    recommendations(0);
    setup(watching);
    await settle();
    expect(screen.queryByRole('region', { name: 'Continue assistindo' })).not.toBeInTheDocument();
  });

  it('shows Recomendados para você with 6 or more items, without a see-all link', async () => {
    progress({});
    recommendations(6);
    setup(watching);
    const region = await screen.findByRole('region', { name: 'Recomendados para você' });
    expect(region.querySelectorAll('li')).toHaveLength(6);
    expect(screen.queryByRole('link', { name: 'Ver tudo: Recomendados para você' })).not.toBeInTheDocument();
  });

  it('keeps Recomendados on screen when a title is saved from it, hiding only that title', async () => {
    progress({});
    recommendations(6);
    setup(watching);
    const region = await screen.findByRole('region', { name: 'Recomendados para você' });
    await waitFor(() => expect(region.querySelectorAll('li')).toHaveLength(6));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Sugestao 0 a Quero ver' }));
    await waitFor(() => expect(region.querySelectorAll('li')).toHaveLength(5));
    await settle(200);
    expect(screen.getByRole('region', { name: 'Recomendados para você' })).toBe(region);
    expect(region).not.toHaveTextContent('Sugestao 0');
  });

  it('hides Recomendados with fewer than 6 items', async () => {
    progress({});
    recommendations(5);
    setup(watching);
    await settle();
    expect(screen.queryByRole('region', { name: 'Recomendados para você' })).not.toBeInTheDocument();
  });

  it('hides Recomendados on error', async () => {
    progress({});
    recommendations('fail');
    setup(watching);
    await settle(200);
    expect(screen.queryByRole('region', { name: 'Recomendados para você' })).not.toBeInTheDocument();
  });
});
