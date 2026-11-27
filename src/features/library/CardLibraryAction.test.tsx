import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MediaSummary } from '@/features/tmdb/types';
import { movie, tv } from '@/test/media';
import { ToastProvider } from '@/ui/toast/ToastProvider';
import { CardLibraryAction } from './CardLibraryAction';
import { applyCommand, type LibraryCommand } from './commands';
import { LibraryProvider } from './LibraryProvider';
import type { LibraryRepository } from './repository';
import { toSnapshot } from './snapshot';
import { EMPTY_LIBRARY, type LibraryState, type LibraryStatus, type TitleRef } from './types';

const NOW = '2026-11-19T12:00:00.000Z';
const item = movie({ id: 550, title: 'Clube da Luta', genreIds: [18] });
const ref: TitleRef = { mediaType: 'movie', tmdbId: 550 };

function setup(
  initial: LibraryState = EMPTY_LIBRARY,
  opts: { hold?: boolean; media?: MediaSummary; onParentClick?: () => void } = {},
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
  const { container } = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <LibraryProvider repository={repository}>
          <div id="host" onClick={opts.onParentClick}>
            <CardLibraryAction item={opts.media ?? item} />
          </div>
        </LibraryProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, applied, container };
}

const withStatus = (status: LibraryStatus, r: TitleRef = ref, m: MediaSummary = item): LibraryState =>
  applyCommand(EMPTY_LIBRARY, { type: 'setStatus', ref: r, status, snapshot: toSnapshot(m) }, NOW);

describe('CardLibraryAction', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.show = function show() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  });

  it('renders nothing before the library is ready', () => {
    const { container } = setup(EMPTY_LIBRARY, { hold: true });
    expect(container.querySelector('#host')).toBeEmptyDOMElement();
  });

  it('renders nothing without a LibraryProvider', () => {
    const { container } = render(<CardLibraryAction item={item} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers to add a title that is not in the library', async () => {
    setup();
    const button = await screen.findByRole('button', { name: 'Adicionar Clube da Luta a Quero ver' });
    expect(button).not.toHaveAttribute('aria-pressed');
  });

  it('adds with a snapshot and shows an undoable toast', async () => {
    const { user, applied } = setup();
    await user.click(await screen.findByRole('button', { name: /Adicionar/ }));
    await waitFor(() =>
      expect(applied).toEqual([{ type: 'setStatus', ref, status: 'want', snapshot: toSnapshot(item) }]),
    );
    expect(await screen.findByText('Salvo em Quero ver')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remover Clube da Luta de Quero ver' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(await screen.findByRole('button', { name: /Adicionar/ })).toBeInTheDocument();
  });

  it('removes a wanted title and can undo it', async () => {
    const { user, applied } = setup(withStatus('want'));
    await user.click(await screen.findByRole('button', { name: /Remover/ }));
    await waitFor(() => expect(applied).toEqual([{ type: 'remove', ref }]));
    expect(await screen.findByText('Removido da sua lista')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(await screen.findByRole('button', { name: /Remover/ })).toBeInTheDocument();
  });

  it('puts a series in want', async () => {
    const show = tv({ id: 7, title: 'Duna' });
    const { user, applied } = setup(EMPTY_LIBRARY, { media: show });
    await user.click(await screen.findByRole('button', { name: 'Adicionar Duna a Quero ver' }));
    await waitFor(() =>
      expect(applied).toEqual([
        { type: 'setStatus', ref: { mediaType: 'tv', tmdbId: 7 }, status: 'want', snapshot: toSnapshot(show) },
      ]),
    );
  });

  it('shows a non-interactive marker for watching', async () => {
    const show = tv({ id: 7, title: 'Duna' });
    setup(withStatus('watching', { mediaType: 'tv', tmdbId: 7 }, show), { media: show });
    expect(await screen.findByText('Na sua lista: assistindo')).toHaveClass('sr-only');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows a non-interactive marker for watched', async () => {
    setup(withStatus('watched'));
    expect(await screen.findByText('Na sua lista: assistido')).toHaveClass('sr-only');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not bubble the click to ancestors', async () => {
    const onParentClick = vi.fn();
    const { user } = setup(EMPTY_LIBRARY, { onParentClick });
    await user.click(await screen.findByRole('button', { name: /Adicionar/ }));
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
