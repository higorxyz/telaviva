import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from './commands';
import { LibraryProvider } from './LibraryProvider';
import type { TvProgressInfo } from './progress';
import type { LibraryRepository } from './repository';
import { SeasonActions } from './SeasonActions';
import { EMPTY_LIBRARY, type LibraryState } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const snapshot = { title: 'Série X', posterPath: null, releaseDate: '2020-01-01', genreIds: [] };
const info: TvProgressInfo = {
  tvId: 7,
  ended: false,
  seasons: [{ seasonNumber: 1, episodeCount: 3 }],
  lastAired: { seasonNumber: 1, episodeNumber: 2 },
  nextToAir: null,
};
const mark = (episodeNumber: number) => ({ tvId: 7, seasonNumber: 1, episodeNumber, watchedAt: NOW });

function setup(aired: number[], initial: LibraryState = EMPTY_LIBRARY) {
  let state = initial;
  const applied: LibraryCommand[] = [];
  const repository: LibraryRepository = {
    persistent: true,
    load: async () => state,
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
          <SeasonActions tvId={7} seasonNumber={1} airedEpisodeNumbers={aired} info={info} snapshot={snapshot} />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, applied };
}

describe('SeasonActions', () => {
  it('marks every aired episode of the season', async () => {
    const { user, applied } = setup([1, 2], { ...EMPTY_LIBRARY, episodes: [mark(1)] });
    await user.click(await screen.findByRole('button', { name: 'Marcar temporada' }));
    expect(applied).toEqual([
      {
        type: 'setEpisodes',
        tvId: 7,
        marks: [
          { seasonNumber: 1, episodeNumber: 1 },
          { seasonNumber: 1, episodeNumber: 2 },
        ],
        watched: true,
        snapshot,
        progress: info,
      },
    ]);
    expect(await screen.findByRole('button', { name: 'Desmarcar temporada' })).toBeInTheDocument();
  });

  it('offers "Desmarcar temporada" when all aired episodes are marked, and unmarks them', async () => {
    const { user, applied } = setup([1, 2], { ...EMPTY_LIBRARY, episodes: [mark(1), mark(2)] });
    await user.click(await screen.findByRole('button', { name: 'Desmarcar temporada' }));
    expect(applied[0]).toMatchObject({
      type: 'setEpisodes',
      watched: false,
      marks: [
        { seasonNumber: 1, episodeNumber: 1 },
        { seasonNumber: 1, episodeNumber: 2 },
      ],
    });
  });

  it('renders nothing without aired episodes', async () => {
    setup([]);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('is disabled before the library loads', () => {
    setup([1]);
    expect(screen.getByRole('button', { name: 'Marcar temporada' })).toBeDisabled();
  });
});
