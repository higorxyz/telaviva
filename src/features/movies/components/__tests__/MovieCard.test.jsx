import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MovieCard from '../MovieCard';

describe('MovieCard', () => {
  it('renderiza título, link e imagem corretamente', () => {
    const movie = {
      id: 123,
      title: 'A Origem',
      poster_path: '/inception.jpg',
      vote_average: 8.4,
    };

    render(
      <MemoryRouter>
        <MovieCard movie={movie} />
      </MemoryRouter>
    );

    const link = screen.getByRole('link', { name: new RegExp(`^${movie.title}`, 'i') });
    expect(link).toHaveAttribute('href', `/movie/${movie.id}`);

    const image = screen.getByRole('img', { name: movie.title });
    expect(image).toHaveAttribute('src', expect.stringContaining(movie.poster_path));
  });

  it('exibe placeholder quando o poster não existe', () => {
    const movie = {
      id: 999,
      title: 'Sem Poster',
      poster_path: null,
      vote_average: 0,
    };

    render(
      <MemoryRouter>
        <MovieCard movie={movie} />
      </MemoryRouter>
    );

    expect(screen.getByText(/poster não disponível/i)).toBeInTheDocument();
    expect(screen.getByText(/avaliação indisponível/i)).toBeInTheDocument();
  });
});


