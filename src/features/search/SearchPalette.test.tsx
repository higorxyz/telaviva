import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { movie, tv } from '@/test/media';
import { server } from '@/test/server';
import { SearchPalette } from './SearchPalette';
import { SearchTrigger } from './SearchTrigger';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

const person = { id: 6384, mediaType: 'person', name: 'Keanu Reeves', profilePath: null, knownForDepartment: 'Acting' };

beforeEach(() => {
  push.mockReset();
  server.use(
    http.get(`${window.location.origin}/api/search`, () =>
      HttpResponse.json({
        page: 1,
        totalPages: 1,
        totalResults: 3,
        results: [person, tv({ id: 7, title: 'Matrix Serie' }), movie({ id: 603, title: 'Matrix' })],
      }),
    ),
  );
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SearchTrigger />
      <input aria-label="outro" />
      <SearchPalette />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const combo = () => screen.getByRole('combobox', { name: 'Buscar filmes, séries e pessoas' });

describe('SearchPalette', () => {
  it('opens with Ctrl+K, focuses the combobox, and navigates with arrows + Enter', async () => {
    const user = setup();
    await user.keyboard('{Control>}k{/Control}');
    expect(combo()).toHaveFocus();
    await user.type(combo(), 'matrix');
    expect(await screen.findByRole('option', { name: 'Matrix, 2020' })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(push).toHaveBeenCalledWith('/filme/603-matrix');
  });

  it('groups results (Filmes, Séries, Pessoas) and wires aria-activedescendant', async () => {
    const user = setup();
    await user.keyboard('{Control>}k{/Control}');
    await user.type(combo(), 'matrix');
    const list = await screen.findByRole('listbox');
    expect(combo()).toHaveAttribute('aria-expanded', 'true');
    expect(combo()).toHaveAttribute('aria-controls', list.id);
    const groups = within(list).getAllByRole('group').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Filmes', 'Séries', 'Pessoas']);
    await user.keyboard('{ArrowDown}');
    const first = within(list).getAllByRole('option')[0]!;
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(combo()).toHaveAttribute('aria-activedescendant', first.id);
    await user.keyboard('{ArrowUp}');
    const last = within(list).getAllByRole('option').at(-1)!;
    expect(combo()).toHaveAttribute('aria-activedescendant', last.id);
  });

  it('scrolls the active option into view', async () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    onTestFinished(() => {
      Element.prototype.scrollIntoView = original;
    });
    const user = setup();
    await user.keyboard('{Control>}k{/Control}');
    await user.type(combo(), 'matrix');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowUp}');
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
    expect(scroll.mock.contexts.at(-1)).toHaveAttribute('id', combo().getAttribute('aria-activedescendant'));
  });

  it('ignores Ctrl+Shift+K', async () => {
    const user = setup();
    await user.keyboard('{Control>}{Shift>}k{/Shift}{/Control}');
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
  });

  it('Enter without a selection goes to /buscar?q=', async () => {
    const user = setup();
    await user.keyboard('{Control>}k{/Control}');
    await user.type(combo(), 'a&b{Enter}');
    expect(push).toHaveBeenCalledWith('/buscar?q=a%26b');
  });

  it('opens with "/" outside inputs but not while typing in one', async () => {
    const user = setup();
    await user.click(screen.getByLabelText('outro'));
    await user.keyboard('/');
    expect(document.querySelector('dialog')).not.toHaveAttribute('open');
    await user.click(document.body);
    await user.keyboard('/');
    expect(document.querySelector('dialog')).toHaveAttribute('open');
  });

  it('opens from the header trigger and returns focus to it on close', async () => {
    const user = setup();
    const trigger = screen.getByRole('button', { name: /Buscar/ });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(trigger);
    expect(combo()).toHaveFocus();
    document.querySelector('dialog')!.close();
    expect(trigger).toHaveFocus();
  });
});
