import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { applyCommand, type LibraryCommand } from './commands';
import { LibraryProvider } from './LibraryProvider';
import { RatingControl } from './RatingControl';
import type { LibraryRepository } from './repository';
import { EMPTY_LIBRARY, type LibraryState, type TitleRef } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const snapshot = { title: 'Clube da Luta', posterPath: null, releaseDate: null, genreIds: [] };
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
          <RatingControl titleRef={ref} snapshot={snapshot} title="Clube da Luta" />
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, applied };
}

const rated = (score: number): LibraryState =>
  applyCommand(EMPTY_LIBRARY, { type: 'rate', ref, score, snapshot }, NOW);

const group = () => screen.getByRole('radiogroup', { name: 'Sua nota para Clube da Luta' });

describe('RatingControl', () => {
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

  it('is a disabled "Dar nota" button until the library loads', () => {
    setup(EMPTY_LIBRARY, { hold: true });
    expect(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' })).toBeDisabled();
  });

  it('enables "Dar nota" once the library loads and there is no rating', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' })).toBeEnabled());
  });

  it('names the rated trigger once, with the title and score, ring decorative', async () => {
    setup(rated(9));
    const button = await screen.findByRole('button', {
      name: 'Sua nota para Clube da Luta: 9 de 10. Mudar nota',
    });
    expect(within(button).queryByRole('img')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dar nota para Clube da Luta' })).toBeNull();
  });

  it('offers 10 radios in a radiogroup, with arrows, Home, End and Enter on the roving tab stop', async () => {
    const { user, applied } = setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' }));
    const radios = within(group()).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(radios.filter((r) => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(radios[0]).toHaveFocus();

    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(radios[2]).toHaveFocus();
    expect(radios[2]).toHaveAttribute('tabindex', '0');
    await user.keyboard('{ArrowLeft}');
    expect(radios[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(radios[9]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(radios[0]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(radios[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(radios[9]).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(applied).toEqual([{ type: 'rate', ref, score: 10, snapshot }]);
  });

  it('rates 9 on click, closes the panel and returns focus to the trigger', async () => {
    const { user, applied } = setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' }));
    await user.click(within(group()).getByRole('radio', { name: '9' }));
    expect(applied).toEqual([{ type: 'rate', ref, score: 9, snapshot }]);
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
    const button = await screen.findByRole('button', { name: /Mudar nota/ });
    await waitFor(() => expect(button).toHaveFocus());
    expect(button).toHaveAccessibleName('Sua nota para Clube da Luta: 9 de 10. Mudar nota');
  });

  it('marks the current score as checked and focuses it on open', async () => {
    const { user } = setup(rated(7));
    await user.click(await screen.findByRole('button', { name: /Mudar nota/ }));
    const seven = within(group()).getByRole('radio', { name: '7' });
    expect(seven).toHaveAttribute('aria-checked', 'true');
    expect(seven).toHaveFocus();
  });

  it('removes the rating with "Remover nota", only offered when rated', async () => {
    const { user, applied } = setup(rated(7));
    await user.click(await screen.findByRole('button', { name: /Mudar nota/ }));
    await user.click(screen.getByRole('button', { name: 'Remover nota' }));
    expect(applied).toEqual([{ type: 'unrate', ref }]);
    expect(await screen.findByRole('button', { name: 'Dar nota para Clube da Luta' })).toHaveFocus();
  });

  it('says a rated movie moved to Assistidos, with an undo that puts it back as it was', async () => {
    const want = applyCommand(EMPTY_LIBRARY, { type: 'setStatus', ref, status: 'want', snapshot }, NOW);
    const { user, applied } = setup(want);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' }));
    await user.click(within(group()).getByRole('radio', { name: '8' }));
    expect(await screen.findByText('Movido para Assistidos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(applied).toHaveLength(2));
    expect(applied[1]).toMatchObject({ type: 'restore', item: { status: 'want' }, rating: null });
  });

  it('shows no toast when re-rating a movie already in Assistidos', async () => {
    const { user } = setup(rated(7));
    await user.click(await screen.findByRole('button', { name: /Mudar nota/ }));
    await user.click(within(group()).getByRole('radio', { name: '9' }));
    await screen.findByRole('button', { name: /9 de 10/ });
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull();
  });

  it('says "Nota removida", with an undo that restores the score', async () => {
    const { user, applied } = setup(rated(7));
    await user.click(await screen.findByRole('button', { name: /Mudar nota/ }));
    await user.click(screen.getByRole('button', { name: 'Remover nota' }));
    expect(await screen.findByText('Nota removida')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(applied[1]).toMatchObject({ type: 'restore', rating: { score: 7 } }));
    expect(await screen.findByRole('button', { name: /7 de 10/ })).toBeInTheDocument();
  });

  it('has no "Remover nota" without a rating', async () => {
    const { user } = setup();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Dar nota para Clube da Luta' }));
    expect(screen.queryByRole('button', { name: 'Remover nota' })).toBeNull();
  });
});
