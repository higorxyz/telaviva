import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  flushApply, harness, installDiscoverHarness, lastUrl, panel, rerenderView, seen, setup, toolbar, trigger,
} from './discover-test-utils';

vi.mock('next/navigation', () => ({ useSearchParams: () => harness.params }));

const h = installDiscoverHarness();

describe('DiscoverView URL state', () => {
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

  it('re-parses the filters when the URL changes from outside (back/forward)', async () => {
    setup('generos=18');
    expect(await screen.findByRole('button', { name: 'Remover filtro Gênero: Drama' })).toBeInTheDocument();

    harness.params = new URLSearchParams('tipo=serie&nota=9');
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
    flushApply();
    expect(lastUrl(h.replace())).toBe('/descobrir?de=2010&ate=2020');
    await vi.waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1].toString()).toBe('de=2010&ate=2020&page=1');

    // Production path: Next now reports the URL we wrote.
    harness.params = new URLSearchParams('de=2010&ate=2020');
    rerenderView();
    await screen.findByRole('button', { name: 'Remover filtro A partir de 2010' });
    flushApply();
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
    flushApply();
    expect(h.replace()).not.toHaveBeenCalled();

    rerenderView('visible');
    expect(panel('Gêneros')).not.toHaveAttribute('open');
    expect(trigger('Gêneros')).toHaveTextContent(/^Gêneros$/);
  });

  it('prunes genres that do not exist for the type from the URL', async () => {
    setup('tipo=serie&generos=28');
    await screen.findByRole('link', { name: /Matrix/ });
    expect(screen.queryByText(/Gênero:/)).toBeNull();
    expect(seen[0].has('generos')).toBe(false);
  });
});
