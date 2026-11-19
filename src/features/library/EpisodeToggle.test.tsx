import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from './commands';
import { EpisodeToggle } from './EpisodeToggle';
import { LibraryProvider } from './LibraryProvider';
import type { TvProgressInfo } from './progress';
import type { LibraryRepository } from './repository';
import { EMPTY_LIBRARY, type LibraryState } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const snapshot = { title: 'Série X', posterPath: null, releaseDate: '2020-01-01', genreIds: [] };
const info: TvProgressInfo = {
  tvId: 7,
  ended: false,
  seasons: [
    { seasonNumber: 1, episodeCount: 3 },
    { seasonNumber: 2, episodeCount: 2 },
  ],
  lastAired: { seasonNumber: 2, episodeNumber: 2 },
  nextToAir: null,
};

const mark = (seasonNumber: number, episodeNumber: number) => ({ tvId: 7, seasonNumber, episodeNumber, watchedAt: NOW });

function setup(
  props: { season?: number; episode?: number; aired?: boolean },
  initial: LibraryState = EMPTY_LIBRARY,
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
          <EpisodeToggle
            tvId={7}
            episode={{ seasonNumber: props.season ?? 1, episodeNumber: props.episode ?? 2 }}
            aired={props.aired ?? true}
            info={info}
            snapshot={snapshot}
          />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, applied };
}

describe('EpisodeToggle', () => {
  it('is disabled and not pressed before the library loads', () => {
    setup({}, EMPTY_LIBRARY, { hold: true });
    const button = screen.getByRole('button', { name: 'Marcar como visto' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the episode as watched and flips to "Visto"', async () => {
    const { user, applied } = setup({});
    await user.click(await screen.findByRole('button', { name: 'Marcar como visto' }));
    expect(applied).toEqual([
      {
        type: 'setEpisodes',
        tvId: 7,
        marks: [{ seasonNumber: 1, episodeNumber: 2 }],
        watched: true,
        snapshot,
        progress: info,
      },
    ]);
    const seen = await screen.findByRole('button', { name: 'Visto' });
    expect(seen).toHaveAttribute('aria-pressed', 'true');
  });

  it('unmarks an already watched episode', async () => {
    const { user, applied } = setup({}, { ...EMPTY_LIBRARY, episodes: [mark(1, 2)] });
    await user.click(await screen.findByRole('button', { name: 'Visto' }));
    expect(applied[0]).toMatchObject({ type: 'setEpisodes', watched: false, marks: [{ seasonNumber: 1, episodeNumber: 2 }] });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Marcar como visto' })).toHaveAttribute('aria-pressed', 'false'),
    );
  });

  it('"Até aqui" sends every aired episode up to this one', async () => {
    const { user, applied } = setup({ season: 2, episode: 1 });
    await user.click(await screen.findByRole('button', { name: 'Marcar até T2E1' }));
    expect(applied).toEqual([
      {
        type: 'setEpisodes',
        tvId: 7,
        marks: [
          { seasonNumber: 1, episodeNumber: 1 },
          { seasonNumber: 1, episodeNumber: 2 },
          { seasonNumber: 1, episodeNumber: 3 },
          { seasonNumber: 2, episodeNumber: 1 },
        ],
        watched: true,
        snapshot,
        progress: info,
      },
    ]);
  });

  it('is disabled with "Ainda não exibido" and has no "Até aqui" for an unaired episode', async () => {
    setup({ aired: false });
    const button = await screen.findByRole('button', { name: 'Ainda não exibido' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: /Marcar até/ })).toBeNull();
  });

  it('has no "Até aqui" for specials, but can still mark them', async () => {
    const { user, applied } = setup({ season: 0, episode: 1 });
    await user.click(await screen.findByRole('button', { name: 'Marcar como visto' }));
    expect(screen.queryByRole('button', { name: /Marcar até/ })).toBeNull();
    expect(applied[0]).toMatchObject({ marks: [{ seasonNumber: 0, episodeNumber: 1 }], watched: true });
  });
});
