import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Activity } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { movie } from '@/test/media';
import { server } from '@/test/server';
import { DiscoverView } from './DiscoverView';
import type { DiscoverCatalog } from './labels';

let params = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => params }));

const catalog: DiscoverCatalog = {
  genres: {
    movie: [{ id: 28, name: 'Ação' }, { id: 18, name: 'Drama' }],
    tv: [{ id: 18, name: 'Drama' }, { id: 10759, name: 'Ação e Aventura' }],
  },
  providers: {
    movie: [{ id: 8, name: 'Netflix', logoPath: '/n.jpg' }],
    tv: [{ id: 8, name: 'Netflix', logoPath: '/n.jpg' }],
  },
};

const seen: URLSearchParams[] = [];

function respond(results: unknown[] = [movie({ id: 603, title: 'Matrix' })]) {
  server.use(
    http.get(`${window.location.origin}/api/discover`, ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json({ page: 1, totalPages: 1, totalResults: results.length, results });
    }),
  );
}

let rerenderView: (mode?: 'visible' | 'hidden') => void = () => {};

function setup(qs: string) {
  params = new URLSearchParams(qs);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (mode: 'visible' | 'hidden' = 'visible') => (
    <QueryClientProvider client={client}>
      <Activity mode={mode}>
        <DiscoverView catalog={catalog} />
      </Activity>
    </QueryClientProvider>
  );
  const { rerender } = render(tree());
  rerenderView = (mode) => act(() => rerender(tree(mode)));
  return userEvent.setup();
}

const toolbar = () => screen.getByRole('search', { name: 'Filtros' });
/** A toolbar trigger by its label, with or without the value summary ("Ano", "Ano · 2010–2019"). */
const trigger = (label: string) =>
  within(toolbar()).getByRole('button', { name: new RegExp('^' + label + '( · .+)?$') });
/** A trigger's panel, found through aria-controls (a closed <dialog> is display:none, so it has no accessible name). */
const panel = (name: string) =>
  document.getElementById(trigger(name).getAttribute('aria-controls')!) as HTMLDialogElement;
const lastUrl = (spy: ReturnType<typeof vi.spyOn>) => String(spy.mock.calls.at(-1)?.[2]);
/** No positive signal exists for "nothing happened": wait a short, explicit window for a stray call. */
const settle = () => new Promise((r) => setTimeout(r, 400));

let mq: { matches: boolean; addEventListener: (t: string, cb: () => void) => void; removeEventListener: () => void };
let onViewportChange: () => void = () => {};

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

let replace: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  seen.length = 0;
  replace = vi.spyOn(window.history, 'replaceState');
  mq = { matches: true, addEventListener: (_t, cb) => (onViewportChange = cb), removeEventListener: () => {} };
  vi.stubGlobal('matchMedia', () => mq);
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  respond();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DiscoverView', () => {
  it('reflects the URL in the toolbar, presets and chips, and fetches the first page with the filters', async () => {
    setup('tipo=serie&generos=18&nota=8&votos=1000&ordem=nota');
    expect(await screen.findByRole('link', { name: /Matrix/ })).toBeInTheDocument();
    expect(seen).toHaveLength(1);
    expect(seen[0].toString()).toBe('tipo=serie&generos=18&nota=8&votos=1000&ordem=nota&page=1');

    const chips = screen.getByRole('group', { name: 'Filtros ativos' });
    expect(within(chips).getByText('Gênero: Drama')).toBeInTheDocument();
    expect(within(chips).getByText('Nota 8+')).toBeInTheDocument();
    expect(within(toolbar()).getByRole('button', { name: 'Séries' })).toHaveAttribute('aria-pressed', 'true');
    expect(trigger('Gêneros')).toHaveTextContent('Gêneros · 1');
    expect(trigger('Nota')).toHaveTextContent('Nota · 8+');
    expect(trigger('Mais')).toHaveTextContent('Mais · 1');
    expect(within(toolbar()).queryByRole('button', { name: /^Duração/ })).toBeNull();
    expect(within(toolbar()).getByLabelText('Ordenar por')).toHaveValue('nota');
    const presets = screen.getByRole('group', { name: 'Atalhos' });
    expect(within(presets).getByRole('button', { name: 'Aclamados' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(presets).queryByRole('button', { name: 'Curtos' })).toBeNull();
  });

  it('opens one dimension per popover, settles rapid toggles into one apply, and keeps multi-select open', async () => {
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(trigger('Gêneros'));
    const genres = panel('Gêneros');
    expect(genres).toHaveAttribute('open');
    expect(trigger('Gêneros')).toHaveAttribute('aria-expanded', 'true');
    expect(trigger('Gêneros')).toHaveAttribute('aria-controls', genres.id);
    expect(within(genres).getByRole('button', { name: 'Ação' })).toHaveFocus();

    fireEvent.click(within(genres).getByRole('button', { name: 'Ação' }));
    fireEvent.click(within(genres).getByRole('button', { name: 'Drama' }));
    expect(screen.getByRole('button', { name: 'Remover filtro Gênero: Drama' })).toBeInTheDocument();
    await vi.waitFor(() => expect(replace).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledTimes(1);
    expect(lastUrl(replace)).toBe('/descobrir?generos=28%2C18');
    await vi.waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1].get('generos')).toBe('28,18');
    expect(genres).toHaveAttribute('open');
    expect(trigger('Gêneros')).toHaveTextContent('Gêneros · 2');

    await user.keyboard('{Escape}');
    expect(genres).not.toHaveAttribute('open');
    expect(trigger('Gêneros')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Aplicar' })).toBeNull();
  });

  it('applies single-choice picks at once and closes their popover, returning focus to the trigger', async () => {
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(trigger('Nota'));
    expect(within(panel('Nota')).getByRole('button', { name: 'Qualquer' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(panel('Nota')).getByRole('button', { name: '7+' }));
    expect(lastUrl(replace)).toBe('/descobrir?nota=7');
    expect(panel('Nota')).not.toHaveAttribute('open');
    expect(trigger('Nota')).toHaveFocus();
    expect(trigger('Nota')).toHaveTextContent('Nota · 7+');

    await user.click(trigger('Duração'));
    await user.click(within(panel('Duração')).getByRole('button', { name: 'Até 90 min' }));
    expect(lastUrl(replace)).toBe('/descobrir?nota=7&duracao=90');

    await user.click(trigger('Ano'));
    await user.click(within(panel('Ano')).getByRole('button', { name: 'Anos 2010' }));
    expect(lastUrl(replace)).toBe('/descobrir?de=2010&ate=2019&nota=7&duracao=90');
    expect(trigger('Ano')).toHaveTextContent('Ano · 2010–2019');
  });

  it('shows a non-standard runtime (the Curtos preset) as the picked segment', async () => {
    const user = setup('duracao=100&votos=100');
    await screen.findByRole('link', { name: /Matrix/ });
    expect(within(screen.getByRole('group', { name: 'Atalhos' })).getByRole('button', { name: 'Curtos' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(trigger('Duração'));
    expect(within(panel('Duração')).getByRole('button', { name: 'Até 100 min' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles presets on and off, merged with the current filters', async () => {
    const user = setup('generos=18');
    await screen.findByRole('link', { name: /Matrix/ });
    const presets = screen.getByRole('group', { name: 'Atalhos' });
    await user.click(within(presets).getByRole('button', { name: 'Aclamados' }));
    expect(lastUrl(replace)).toBe('/descobrir?generos=18&nota=8&votos=1000&ordem=nota');
    expect(within(presets).getByRole('button', { name: 'Aclamados' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(presets).getByRole('button', { name: 'Aclamados' }));
    expect(lastUrl(replace)).toBe('/descobrir?generos=18');
  });

  it('closes the desktop popover on an outside click without pulling focus back, and via its close button', async () => {
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(trigger('Mais'));
    expect(within(panel('Mais')).getByLabelText('Idioma original')).toBeInTheDocument();
    await user.click(document.body);
    expect(panel('Mais')).not.toHaveAttribute('open');
    expect(trigger('Mais')).not.toHaveFocus();

    await user.click(trigger('Mais'));
    await user.click(within(panel('Mais')).getByRole('button', { name: 'Fechar Mais' }));
    expect(panel('Mais')).not.toHaveAttribute('open');
    expect(trigger('Mais')).toHaveFocus();
  });

  it('mobile: opens a bottom sheet, closes on Esc and when the viewport becomes wide', async () => {
    mq.matches = false;
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(trigger('Onde assistir'));
    const sheet = panel('Onde assistir');
    expect(sheet).toHaveAttribute('open');
    expect(within(sheet).getByText('Dados de streaming fornecidos por JustWatch.')).toBeInTheDocument();
    act(() => (sheet as HTMLDialogElement).close()); // what Esc does on a native modal dialog
    expect(sheet).not.toHaveAttribute('open');
    expect(trigger('Onde assistir')).toHaveFocus();

    await user.click(trigger('Onde assistir'));
    mq.matches = true;
    act(() => onViewportChange());
    expect(sheet).not.toHaveAttribute('open');
  });

  it('removes a chip immediately and clears everything', async () => {
    const user = setup('generos=28,18&nota=7.5');
    await screen.findByRole('link', { name: /Matrix/ });

    await user.click(screen.getByRole('button', { name: 'Remover filtro Gênero: Ação' }));
    expect(lastUrl(replace)).toBe('/descobrir?generos=18&nota=7.5');
    expect(screen.queryByRole('button', { name: 'Remover filtro Gênero: Ação' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(lastUrl(replace)).toBe('/descobrir');
    expect(screen.queryByRole('button', { name: 'Limpar tudo' })).toBeNull();
    expect(trigger('Gêneros')).toHaveTextContent(/^Gêneros$/);
  });

  it('drops genres and runtime that do not exist for the new type when switching tipo', async () => {
    const user = setup('generos=28,18&duracao=100');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(within(toolbar()).getByRole('button', { name: 'Séries' }));
    expect(lastUrl(replace)).toBe('/descobrir?tipo=serie&generos=18');
    expect(within(toolbar()).queryByRole('button', { name: /^Duração/ })).toBeNull();
    await user.click(trigger('Gêneros'));
    expect(within(panel('Gêneros')).queryByRole('button', { name: 'Ação' })).toBeNull();
    expect(within(panel('Gêneros')).getByRole('button', { name: 'Drama' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('re-parses the filters when the URL changes from outside (back/forward)', async () => {
    setup('generos=18');
    expect(await screen.findByRole('button', { name: 'Remover filtro Gênero: Drama' })).toBeInTheDocument();

    params = new URLSearchParams('tipo=serie&nota=9');
    rerenderView();
    expect(await screen.findByRole('button', { name: 'Remover filtro Nota 9+' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover filtro Gênero: Drama' })).toBeNull();
    expect(within(toolbar()).getByRole('button', { name: 'Séries' })).toHaveAttribute('aria-pressed', 'true');
    await vi.waitFor(() => expect(seen.at(-1)?.toString()).toBe('tipo=serie&nota=9&page=1'));
  });

  it('canonicalizes on apply and does not refetch when useSearchParams catches up to the written URL', async () => {
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(trigger('Ano'));
    // Same tick, so both edits settle into one apply regardless of machine load.
    fireEvent.change(within(panel('Ano')).getByLabelText('De'), { target: { value: '2020' } });
    fireEvent.change(within(panel('Ano')).getByLabelText('Até'), { target: { value: '2010' } });
    await vi.waitFor(() => expect(lastUrl(replace)).toBe('/descobrir?de=2010&ate=2020'));
    await vi.waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1].toString()).toBe('de=2010&ate=2020&page=1');

    // Production path: Next now reports the URL we wrote.
    params = new URLSearchParams('de=2010&ate=2020');
    rerenderView();
    await screen.findByRole('button', { name: 'Remover filtro A partir de 2010' });
    await settle();
    expect(seen).toHaveLength(2);
  });

  it('closes popovers and drops a pending apply when the route is hidden in an Activity', async () => {
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(trigger('Gêneros'));
    const genres = panel('Gêneros');
    fireEvent.click(within(genres).getByRole('button', { name: 'Ação' }));
    rerenderView('hidden');
    expect(genres).not.toHaveAttribute('open');
    await settle();
    expect(replace).not.toHaveBeenCalled();

    rerenderView('visible');
    expect(panel('Gêneros')).not.toHaveAttribute('open');
    expect(trigger('Gêneros')).toHaveTextContent(/^Gêneros$/);
  });

  it('shows an empty state with a way out', async () => {
    respond([]);
    const user = setup('nota=9');
    expect(await screen.findByText('Nada por aqui')).toBeInTheDocument();
    respond();
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(await screen.findByRole('link', { name: /Matrix/ })).toBeInTheDocument();
  });

  it('shows an error with retry when the API fails', async () => {
    server.use(http.get(`${window.location.origin}/api/discover`, () => HttpResponse.json({ error: 'x' }, { status: 502 })));
    const user = setup('');
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo deu errado');
    respond();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('link', { name: /Matrix/ })).toBeInTheDocument();
  });

  it('prunes genres that do not exist for the type from the URL', async () => {
    setup('tipo=serie&generos=28');
    await screen.findByRole('link', { name: /Matrix/ });
    expect(screen.queryByText(/Gênero:/)).toBeNull();
    expect(seen[0].has('generos')).toBe(false);
  });

  it('moves focus to a sensible chip after removal, and to the region when none are left', async () => {
    const user = setup('generos=28,18&nota=8');
    await screen.findByRole('link', { name: /Matrix/ });
    const remove = (name: string) => screen.getByRole('button', { name: `Remover filtro ${name}` });

    await user.click(remove('Gênero: Ação'));
    expect(remove('Gênero: Drama')).toHaveFocus();
    await user.click(remove('Nota 8+'));
    expect(remove('Gênero: Drama')).toHaveFocus(); // no next chip: the previous one
    await user.click(remove('Gênero: Drama'));
    expect(screen.getByRole('group', { name: 'Filtros ativos' })).toHaveFocus();
  });
});
