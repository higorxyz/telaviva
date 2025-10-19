import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import MovieDetails from '../MovieDetails';
import { API_BASE_URL, rest, server } from '../../../../test-utils/server';
import renderWithProviders from '../../../../test-utils/renderWithProviders';

const renderMovieDetails = (movieId = '1') =>
  renderWithProviders(
    <Routes>
      <Route path="/movie/:id" element={<MovieDetails />} />
    </Routes>,
    { initialEntries: [`/movie/${movieId}`] }
  );

describe('MovieDetails', () => {
  it('apresenta detalhes do filme e alterna listas com sucesso', async () => {
    renderMovieDetails();

    const title = await screen.findByRole('heading', { name: 'Matrix Resurrections' });
    expect(title).toBeInTheDocument();

    const trailer = await screen.findByTitle('Trailer');
    expect(trailer).toHaveAttribute('src', expect.stringContaining('dQw4w9WgXcQ'));

    const addWatchedButton = screen.getByRole('button', { name: /adicionar aos assistidos/i });

    await userEvent.click(addWatchedButton);
    expect(screen.getByRole('button', { name: /remover dos assistidos/i })).toBeInTheDocument();

    const addToWatchButton = screen.getByRole('button', { name: /adicionar à lista para assistir/i });

    await userEvent.click(addToWatchButton);
    expect(await screen.findByText('Keanu Reeves')).toBeInTheDocument();
    expect(await screen.findByText('Carrie-Anne Moss')).toBeInTheDocument();
  });

  it('exibe mensagem de erro quando o filme não existe', async () => {
    server.use(
      rest.get(`${API_BASE_URL}/movie/:movieId`, (req, res, ctx) =>
        res(ctx.status(404), ctx.json({ status_message: 'Recurso não encontrado.' }))
      )
    );

    renderMovieDetails('999');

    expect(await screen.findByText(/recurso não encontrado/i)).toBeInTheDocument();
  });
});