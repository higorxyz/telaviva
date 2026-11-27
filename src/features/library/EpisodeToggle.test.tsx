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

  it('"Até aqui" sends every aired episode up to this one, and its name contains the visible text', async () => {
    const { user, applied } = setup({ season: 2, episode: 1 });
    const button = await screen.findByRole('button', { name: 'Até aqui: marcar até T2E1' });
    expect(button).toHaveTextContent('Até aqui');
    await user.click(button);
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

  it('"Até aqui" offers an undo that puts the marks back as they were', async () => {
    const { user, applied } = setup({ season: 2, episode: 1 }, { ...EMPTY_LIBRARY, episodes: [mark(1, 1)] });
    await user.click(await screen.findByRole('button', { name: 'Até aqui: marcar até T2E1' }));
    expect(await screen.findByText('Marcado até T2E1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(applied).toHaveLength(2));
    expect(applied[1]).toMatchObject({ type: 'restore', item: null, marks: [mark(1, 1)] });
  });

  it('"Até aqui" on an episode aired today but past TMDb\'s last aired one still marks it', async () => {
    // info.lastAired is T2E2; the page knows T2E2 aired, and pretends a third T2 episode aired today.
    const { user, applied } = setup({ season: 2, episode: 3 });
    await user.click(await screen.findByRole('button', { name: 'Até aqui: marcar até T2E3' }));
    const marks = (applied[0] as { marks: { seasonNumber: number; episodeNumber: number }[] }).marks;
    expect(marks.at(-1)).toEqual({ seasonNumber: 2, episodeNumber: 3 });
    expect(marks).toHaveLength(6);
  });

  it('a single episode toggle shows no toast', async () => {
    const { user } = setup({});
    await user.click(await screen.findByRole('button', { name: 'Marcar como visto' }));
    await screen.findByRole('button', { name: 'Visto' });
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });

  it('is disabled with "Ainda não exibido" and has no "Até aqui" for an unaired episode', async () => {
    setup({ aired: false });
    const button = await screen.findByRole('button', { name: 'Ainda não exibido' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: /Até aqui/ })).toBeNull();
  });

  it('has no "Até aqui" for specials, but can still mark them', async () => {
    const { user, applied } = setup({ season: 0, episode: 1 });
    await user.click(await screen.findByRole('button', { name: 'Marcar como visto' }));
    expect(screen.queryByRole('button', { name: /Até aqui/ })).toBeNull();
    expect(applied[0]).toMatchObject({ marks: [{ seasonNumber: 0, episodeNumber: 1 }], watched: true });
  });
});
