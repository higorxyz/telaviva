import React from 'react';
import { fetchPopularMovies } from '../api';
import MovieList from '../components/MovieList';

const PopularMovies = () => {
  return <MovieList title="Filmes Populares" fetchFunction={fetchPopularMovies} />;
};

export default PopularMovies;
