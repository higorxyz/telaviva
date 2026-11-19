import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EpisodeSummary, SeasonDetails } from '@/features/tmdb/types';
import { EpisodeList } from './EpisodeList';

const ep = (n: number, airDate: string | null, over: Partial<EpisodeSummary> = {}): EpisodeSummary => ({
  seasonNumber: 1,
  episodeNumber: n,
  name: `Episódio ${n}`,
  overview: '',
  airDate,
  stillPath: null,
  runtime: 58,
  voteAverage: 0,
  ...over,
});
const season = (episodes: EpisodeSummary[]): SeasonDetails => ({ seasonNumber: 1, name: 'T1', overview: '', episodes });

describe('EpisodeList', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T12:00:00-03:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mostra "Data a definir" quando falta a data', () => {
    render(<EpisodeList season={season([ep(1, '2026-01-01'), ep(2, null)])} />);
    expect(screen.getByText('Data a definir')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('E1 · Episódio 1')).toBeInTheDocument();
    expect(screen.getAllByText('58min')).toHaveLength(2);
  });

  it('episódio futuro ganha o selo de estreia; passado não', () => {
    render(<EpisodeList season={season([ep(1, '2026-01-01'), ep(2, '2027-07-17')])} />);
    expect(screen.getByText('Estreia 17 de jul. de 2027')).toBeInTheDocument();
    expect(screen.queryAllByText(/^Estreia/)).toHaveLength(1);
  });

  it('usa placeholder sem still e imagem w300 com still', () => {
    render(<EpisodeList season={season([ep(1, '2026-01-01'), ep(2, '2026-01-02', { stillPath: '/a.jpg' })])} />);
    expect(screen.getAllByTestId('still-placeholder')).toHaveLength(1);
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w300/a.jpg');
  });

  it('sinopse longa expande e recolhe com botão acessível', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(90);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(60);
    const user = userEvent.setup();
    render(<EpisodeList season={season([ep(1, '2026-01-01', { overview: 'palavra '.repeat(60) })])} />);
    const btn = await screen.findByRole('button', { name: 'Ler mais' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    expect(screen.getByRole('button', { name: 'Mostrar menos' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('sinopse curta não tem botão; renderAction entra no item', () => {
    render(
      <EpisodeList
        season={season([ep(1, '2026-01-01', { overview: 'Curta.' })])}
        renderAction={(e) => <button type="button">Marcar E{e.episodeNumber}</button>}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Ler mais' })).toBeNull();
    expect(within(screen.getByRole('listitem')).getByRole('button', { name: 'Marcar E1' })).toBeInTheDocument();
  });

  it('renderAction recebe se o episódio já foi exibido', () => {
    render(
      <EpisodeList
        season={season([ep(1, '2026-01-01'), ep(2, '2026-11-18'), ep(3, '2026-11-19'), ep(4, null)])}
        renderAction={(e, aired) => <span>{`E${e.episodeNumber} ${aired ? 'exibido' : 'futuro'}`}</span>}
      />,
    );
    expect(screen.getByText('E1 exibido')).toBeInTheDocument();
    expect(screen.getByText('E2 exibido')).toBeInTheDocument();
    expect(screen.getByText('E3 futuro')).toBeInTheDocument();
    expect(screen.getByText('E4 futuro')).toBeInTheDocument();
  });

  it('renderSeasonActions entra acima da lista com os números dos episódios exibidos', () => {
    const received: number[][] = [];
    render(
      <EpisodeList
        season={season([ep(1, '2026-01-01'), ep(2, '2026-11-18'), ep(3, '2026-11-19'), ep(4, null)])}
        renderSeasonActions={(s, aired) => {
          received.push(aired);
          return <p>{`Ações da T${s.seasonNumber}`}</p>;
        }}
      />,
    );
    expect(received).toEqual([[1, 2]]);
    const actions = screen.getByText('Ações da T1');
    const list = screen.getByRole('list');
    expect(actions.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('temporada sem episódios mostra estado vazio', () => {
    render(<EpisodeList season={season([])} />);
    expect(screen.getByText('Ainda não há episódios cadastrados.')).toBeInTheDocument();
  });
});
