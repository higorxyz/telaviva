import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { movie } from '@/test/media';
import type { PersonCredit } from '@/features/tmdb/types';
import { Filmography } from './Filmography';
import { toFilmRows } from './person';

const c = (o: Partial<PersonCredit>): PersonCredit => ({ ...movie(), role: '', department: 'Acting', ...o });

function setup(credits: PersonCredit[]) {
  render(<Filmography rows={toFilmRows(credits)} />);
}

describe('Filmography', () => {
  it('lista cada título uma vez, agrupado por ano, com papéis unidos', () => {
    setup([
      c({ id: 1, title: 'Alfa', role: 'Produtor', department: 'Production' }),
      c({ id: 1, title: 'Alfa', role: 'Diretor', department: 'Directing' }),
    ]);
    expect(screen.getAllByRole('link', { name: 'Alfa' })).toHaveLength(1);
    expect(screen.getByText('Produtor, Diretor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: '2020' })).toBeInTheDocument();
  });

  it('filtra por atuação e equipe com aria-pressed', async () => {
    const user = userEvent.setup();
    setup([
      c({ id: 1, title: 'Ator', role: 'Herói' }),
      c({ id: 2, title: 'Diretor', role: 'Diretor', department: 'Directing' }),
    ]);
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Atuação' }));
    expect(screen.getByRole('button', { name: 'Atuação' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('link', { name: 'Diretor' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Equipe' }));
    expect(screen.queryByRole('link', { name: 'Ator' })).toBeNull();
    expect(within(screen.getByRole('list')).getByRole('link', { name: 'Diretor' })).toBeInTheDocument();
  });

  it('mostra estado vazio quando o filtro não tem créditos', async () => {
    const user = userEvent.setup();
    setup([c({ id: 1, title: 'Ator' })]);
    await user.click(screen.getByRole('button', { name: 'Equipe' }));
    expect(screen.getByText('Nada por aqui')).toBeInTheDocument();
  });
});
