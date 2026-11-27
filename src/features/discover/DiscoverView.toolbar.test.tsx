import { act, fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import {
  flushApply, harness, installDiscoverHarness, lastUrl, panel, respond, seen, setup, toolbar, trigger,
  viewport,
} from './discover-test-utils';

vi.mock('next/navigation', () => ({ useSearchParams: () => harness.params }));

const h = installDiscoverHarness();

describe('DiscoverView toolbar', () => {
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
    flushApply();
    expect(h.replace()).toHaveBeenCalledTimes(1);
    expect(lastUrl(h.replace())).toBe('/descobrir?generos=28%2C18');
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
    expect(lastUrl(h.replace())).toBe('/descobrir?nota=7');
    expect(panel('Nota')).not.toHaveAttribute('open');
    expect(trigger('Nota')).toHaveFocus();
    expect(trigger('Nota')).toHaveTextContent('Nota · 7+');

    await user.click(trigger('Duração'));
    await user.click(within(panel('Duração')).getByRole('button', { name: 'Até 90 min' }));
    expect(lastUrl(h.replace())).toBe('/descobrir?nota=7&duracao=90');

    await user.click(trigger('Ano'));
    await user.click(within(panel('Ano')).getByRole('button', { name: 'Anos 2010' }));
    expect(lastUrl(h.replace())).toBe('/descobrir?de=2010&ate=2019&nota=7&duracao=90');
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
    expect(lastUrl(h.replace())).toBe('/descobrir?generos=18&nota=8&votos=1000&ordem=nota');
    expect(within(presets).getByRole('button', { name: 'Aclamados' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(presets).getByRole('button', { name: 'Aclamados' }));
    expect(lastUrl(h.replace())).toBe('/descobrir?generos=18');
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
    viewport.mq.matches = false;
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
    viewport.mq.matches = true;
    act(() => viewport.onChange());
    expect(sheet).not.toHaveAttribute('open');
  });

  it('removes a chip immediately and clears everything', async () => {
    const user = setup('generos=28,18&nota=7.5');
    await screen.findByRole('link', { name: /Matrix/ });

    await user.click(screen.getByRole('button', { name: 'Remover filtro Gênero: Ação' }));
    expect(lastUrl(h.replace())).toBe('/descobrir?generos=18&nota=7.5');
    expect(screen.queryByRole('button', { name: 'Remover filtro Gênero: Ação' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(lastUrl(h.replace())).toBe('/descobrir');
    expect(screen.queryByRole('button', { name: 'Limpar tudo' })).toBeNull();
    expect(trigger('Gêneros')).toHaveTextContent(/^Gêneros$/);
  });

  it('keeps Disponível no Brasil on by default; turning it off shows a chip, and Limpar tudo turns it back on', async () => {
    const user = setup('generos=18');
    await screen.findByRole('link', { name: /Matrix/ });
    const toggle = within(toolbar()).getByRole('button', { name: 'Disponível no Brasil' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Remover filtro Inclui indisponíveis no Brasil' })).toBeNull();
    expect(seen[0].has('disponivel')).toBe(false);

    await user.click(toggle);
    expect(lastUrl(h.replace())).toBe('/descobrir?generos=18&disponivel=0');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Remover filtro Inclui indisponíveis no Brasil' })).toBeInTheDocument();
    await vi.waitFor(() => expect(seen.at(-1)!.get('disponivel')).toBe('0'));

    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(lastUrl(h.replace())).toBe('/descobrir');
    expect(within(toolbar()).getByRole('button', { name: 'Disponível no Brasil' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Limpar tudo' })).toBeNull();
  });

  it('drops genres and runtime that do not exist for the new type when switching tipo', async () => {
    const user = setup('generos=28,18&duracao=100');
    await screen.findByRole('link', { name: /Matrix/ });
    await user.click(within(toolbar()).getByRole('button', { name: 'Séries' }));
    expect(lastUrl(h.replace())).toBe('/descobrir?tipo=serie&generos=18');
    expect(within(toolbar()).queryByRole('button', { name: /^Duração/ })).toBeNull();
    await user.click(trigger('Gêneros'));
    expect(within(panel('Gêneros')).queryByRole('button', { name: 'Ação' })).toBeNull();
    expect(within(panel('Gêneros')).getByRole('button', { name: 'Drama' })).toHaveAttribute('aria-pressed', 'true');
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
