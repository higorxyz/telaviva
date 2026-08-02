import React from 'react';
import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import PersonProfile from '../PersonProfile';
import { API_BASE_URL, rest, server } from '../../../../test-utils/server';
import renderWithProviders from '../../../../test-utils/renderWithProviders';

const renderPersonProfile = (personId = '100') =>
  renderWithProviders(
    <Routes>
      <Route path="/person/:id" element={<PersonProfile />} />
      <Route path="/movie/:id" element={<div>Detalhes do filme</div>} />
    </Routes>,
    { initialEntries: [`/person/${personId}`] }
  );

describe('PersonProfile', () => {
  it('exibe dados da pessoa e filmografia de atuação com links para filmes', async () => {
    renderPersonProfile();

    const title = await screen.findByRole('heading', { name: 'Keanu Reeves' });
    expect(title).toBeInTheDocument();

    const personalInfoSection = screen.getByTestId('person-profile-personal-info');
    const personalInfo = within(personalInfoSection);
    expect(personalInfo.getByText(/conhecido\(a\) por/i)).toBeInTheDocument();
    expect(personalInfo.getByText('Atuação')).toBeInTheDocument();
    expect(personalInfo.getByText(/também participou como/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/produção/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/creditado\(a\) em/i)).toBeInTheDocument();
    expect(personalInfo.getByText('4')).toBeInTheDocument();
    expect(personalInfo.getByText(/gênero/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/masculino/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/^nascimento$/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/setembro de 1964/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/de idade/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/local de nascimento \(em inglês\)/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/beirute, líbano/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/também conhecido\(a\) como/i)).toBeInTheDocument();
    expect(personalInfo.getByText(/keanu charles reeves/i)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /conhecido por/i })).toBeInTheDocument();
    expect(screen.getByText(/keanu charles reeves é um ator canadense/i)).toBeInTheDocument();

    const matrixMovieLink = await screen.findByRole('link', {
      name: /abrir detalhes de matrix resurrections/i,
    });
    expect(matrixMovieLink).toHaveAttribute('href', '/movie/1');

    expect(screen.getAllByText(/como neo/i)).toHaveLength(1);
    expect(screen.getByRole('heading', { name: /linha do tempo/i })).toBeInTheDocument();
    const timelineSection = screen.getByTestId('person-profile-timeline');
    expect(within(timelineSection).getByRole('link', { name: 'Matrix Resurrections' })).toHaveAttribute('href', '/movie/1');
    expect(within(timelineSection).getByText(/produção/i)).toBeInTheDocument();
    expect(screen.getAllByText(/filme sem poster/i).length).toBeGreaterThan(0);

    expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir para início/i })).toHaveAttribute('href', '/');
  });

  it('personaliza a seção de filmografia para atriz quando o gênero é feminino', async () => {
    renderPersonProfile('101');

    const title = await screen.findByRole('heading', { name: 'Carrie-Anne Moss' });
    expect(title).toBeInTheDocument();

    const personalInfoSection = screen.getByTestId('person-profile-personal-info');
    const personalInfo = within(personalInfoSection);
    expect(personalInfo.getByText(/feminino/i)).toBeInTheDocument();
    expect(personalInfo.getByText('0')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /conhecida por/i })).toBeInTheDocument();
  });

  it('mostra no máximo 8 títulos na seção conhecido(a) por, mantendo a linha do tempo completa', async () => {
    server.use(
      rest.get(`${API_BASE_URL}/person/:personId/movie_credits`, (req, res, ctx) => {
        const cast = Array.from({ length: 10 }).map((_, index) => ({
          id: 1000 + index,
          title: `Filme ${String(index + 1).padStart(2, '0')}`,
          poster_path: index % 2 === 0 ? `/poster-${index + 1}.jpg` : null,
          release_date: `${2015 + index}-01-01`,
          vote_average: 7,
          vote_count: 5000 - index,
          popularity: 200 - index,
          order: index,
          character: `Personagem ${index + 1}`,
        }));

        return res(ctx.status(200), ctx.json({ id: 100, cast, crew: [] }));
      })
    );

    renderPersonProfile('100');

    expect(await screen.findByRole('heading', { name: /conhecido por/i })).toBeInTheDocument();

    const personalInfoSection = screen.getByTestId('person-profile-personal-info');
    expect(within(personalInfoSection).getByText('10')).toBeInTheDocument();

    const knownForLinks = await screen.findAllByRole('link', {
      name: /abrir detalhes de filme/i,
    });

    expect(knownForLinks).toHaveLength(8);
    expect(screen.getByText('Filme 10')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir detalhes de filme 09/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /abrir detalhes de filme 10/i })).not.toBeInTheDocument();
  });

  it('agrupa filmes do mesmo ano em um único bloco na linha do tempo', async () => {
    server.use(
      rest.get(`${API_BASE_URL}/person/:personId/movie_credits`, (req, res, ctx) =>
        res(
          ctx.status(200),
          ctx.json({
            id: 100,
            cast: [
              {
                id: 2001,
                title: 'Projeto Alpha',
                poster_path: '/alpha.jpg',
                release_date: '2024-06-11',
                vote_average: 7,
                vote_count: 1000,
                popularity: 120,
                order: 1,
                character: 'Alex',
              },
              {
                id: 2002,
                title: 'Projeto Beta',
                poster_path: '/beta.jpg',
                release_date: '2024-01-04',
                vote_average: 6.8,
                vote_count: 900,
                popularity: 115,
                order: 3,
                character: 'Blake',
              },
              {
                id: 2003,
                title: 'Projeto Gamma',
                poster_path: '/gamma.jpg',
                release_date: '2023-03-19',
                vote_average: 7.2,
                vote_count: 800,
                popularity: 98,
                order: 0,
                character: 'Gray',
              },
            ],
            crew: [],
          })
        )
      )
    );

    renderPersonProfile('100');

    expect(await screen.findByRole('heading', { name: /linha do tempo/i })).toBeInTheDocument();

    const timelineSection = screen.getByTestId('person-profile-timeline');
    const timeline = within(timelineSection);

    expect(timeline.getAllByText('2024')).toHaveLength(1);
    expect(timeline.getByRole('link', { name: 'Projeto Alpha' })).toHaveAttribute('href', '/movie/2001');
    expect(timeline.getByRole('link', { name: 'Projeto Beta' })).toHaveAttribute('href', '/movie/2002');
    expect(timeline.getByRole('link', { name: 'Projeto Gamma' })).toHaveAttribute('href', '/movie/2003');
  });

  it('mostra mensagem amigável quando o perfil não existe', async () => {
    server.use(
      rest.get(`${API_BASE_URL}/person/:personId`, (req, res, ctx) =>
        res(ctx.status(404), ctx.json({ status_message: 'Recurso não encontrado.' }))
      )
    );

    renderPersonProfile('999');

    expect(await screen.findByText(/não encontramos este perfil de ator ou atriz/i)).toBeInTheDocument();
  });
});
