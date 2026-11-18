import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
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

function setup(qs: string) {
  params = new URLSearchParams(qs);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DiscoverView catalog={catalog} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const sidebar = () => screen.getByRole('complementary', { name: 'Filtros de busca' });
const lastUrl = (spy: ReturnType<typeof vi.spyOn>) => String(spy.mock.calls.at(-1)?.[2]);

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

let replace: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  seen.length = 0;
  window.localStorage.clear();
  replace = vi.spyOn(window.history, 'replaceState');
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  respond();
});
afterEach(() => vi.restoreAllMocks());

describe('DiscoverView', () => {
  it('reflects the URL in chips and controls, and fetches the first page with the filters', async () => {
    setup('tipo=serie&generos=18&nota=8&votos=1000&ordem=nota');
    expect(await screen.findByRole('link', { name: /Matrix/ })).toBeInTheDocument();
    expect(seen).toHaveLength(1);
    expect(seen[0].toString()).toBe('tipo=serie&generos=18&nota=8&votos=1000&ordem=nota&page=1');

    const chips = screen.getByRole('list', { name: 'Filtros ativos' });
    expect(within(chips).getByText('Gênero: Drama')).toBeInTheDocument();
    expect(within(chips).getByText('Nota 8,0+')).toBeInTheDocument();
    expect(within(sidebar()).getByRole('button', { name: 'Série' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sidebar()).getByRole('button', { name: 'Drama' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(sidebar()).getByLabelText('Ordenar por')).toHaveValue('nota');
    expect(within(sidebar()).queryByLabelText('Duração máxima')).toBeNull();
  });

  it('does not request anything while editing, only on Aplicar, and writes the URL', async () => {
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    const panel = within(sidebar());

    await user.click(panel.getByRole('button', { name: 'Ação' }));
    await user.click(panel.getByRole('button', { name: 'Netflix' }));
    await user.selectOptions(panel.getByLabelText('Votos mínimos'), '500');
    expect(panel.getByLabelText('Duração máxima')).toHaveAttribute('aria-valuetext', 'Qualquer duração');
    expect(seen).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();

    await user.click(panel.getByRole('button', { name: 'Aplicar' }));
    expect(lastUrl(replace)).toBe('/descobrir?generos=28&votos=500&provedores=8');
    await vi.waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1].get('generos')).toBe('28');
    expect(seen[1].get('provedores')).toBe('8');
    expect(screen.getByRole('button', { name: 'Remover filtro Gênero: Ação' })).toBeInTheDocument();
  });

  it('removes a chip immediately and clears everything', async () => {
    const user = setup('generos=28,18&nota=7.5');
    await screen.findByRole('link', { name: /Matrix/ });

    await user.click(screen.getByRole('button', { name: 'Remover filtro Gênero: Ação' }));
    expect(lastUrl(replace)).toBe('/descobrir?generos=18&nota=7.5');
    expect(screen.queryByRole('button', { name: 'Remover filtro Gênero: Ação' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(lastUrl(replace)).toBe('/descobrir');
    expect(screen.queryByRole('list', { name: 'Filtros ativos' })).toBeNull();
    expect(within(sidebar()).getByRole('button', { name: 'Drama' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('drops genres that do not exist for the new type when switching tipo', async () => {
    const user = setup('generos=28,18&duracao=100');
    await screen.findByRole('link', { name: /Matrix/ });
    const panel = within(sidebar());
    expect(panel.getByLabelText('Duração máxima')).toHaveAttribute('aria-valuetext', 'até 100 minutos');
    expect(panel.getByText('até 100 min')).toBeInTheDocument();

    await user.click(panel.getByRole('button', { name: 'Série' }));
    expect(panel.queryByRole('button', { name: 'Ação' })).toBeNull();
    expect(panel.getByRole('button', { name: 'Drama' })).toHaveAttribute('aria-pressed', 'true');
    expect(panel.queryByLabelText('Duração máxima')).toBeNull();
    await user.click(panel.getByRole('button', { name: 'Aplicar' }));
    expect(lastUrl(replace)).toBe('/descobrir?tipo=serie&generos=18');
  });

  it('re-parses the filters when the URL changes from outside (back/forward)', async () => {
    params = new URLSearchParams('generos=18');
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = () => (
      <QueryClientProvider client={client}>
        <DiscoverView catalog={catalog} />
      </QueryClientProvider>
    );
    const { rerender } = render(tree());
    expect(await screen.findByRole('button', { name: 'Remover filtro Gênero: Drama' })).toBeInTheDocument();

    params = new URLSearchParams('tipo=serie&nota=9');
    rerender(tree());
    expect(await screen.findByRole('button', { name: 'Remover filtro Nota 9,0+' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover filtro Gênero: Drama' })).toBeNull();
    expect(within(sidebar()).getByRole('button', { name: 'Série' })).toHaveAttribute('aria-pressed', 'true');
    await vi.waitFor(() => expect(seen.at(-1)?.toString()).toBe('tipo=serie&nota=9&page=1'));
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

  it('collapses the sidebar and remembers it in localStorage', async () => {
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(screen.getByRole('button', { name: 'Ocultar filtros' }));
    expect(screen.queryByRole('complementary', { name: 'Filtros de busca' })).toBeNull();
    expect(window.localStorage.getItem('telaviva:discover-sidebar-collapsed')).toBe('1');
    expect(screen.getByRole('button', { name: 'Mostrar filtros' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('survives unavailable localStorage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const user = setup('');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(screen.getByRole('button', { name: 'Ocultar filtros' }));
    expect(screen.getByRole('complementary', { name: 'Filtros de busca' })).toBeInTheDocument();
  });

  it('mobile: Filtros (n) opens a dialog sheet; Aplicar applies and closes it; the close button works', async () => {
    const user = setup('nota=8&generos=18');
    await screen.findByRole('link', { name: /Matrix/ });
    const open = screen.getByRole('button', { name: 'Filtros (2)' });
    await user.click(open);

    const dialog = screen.getByRole('dialog', { name: 'Filtros', hidden: true });
    expect(dialog).toHaveAttribute('open');
    const sheet = within(dialog);
    await user.click(sheet.getByRole('button', { name: 'Ação' }));
    await user.click(sheet.getByRole('button', { name: 'Aplicar' }));
    expect(dialog).not.toHaveAttribute('open');
    expect(lastUrl(replace)).toBe('/descobrir?generos=18%2C28&nota=8');
    expect(screen.getByRole('button', { name: 'Filtros (3)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtros (3)' }));
    await user.click(within(dialog).getByRole('button', { name: 'Fechar filtros' }));
    expect(dialog).not.toHaveAttribute('open');
  });
});
