import React from 'react';
import { fetchTopRatedMovies } from '../api';
import MovieList from '../components/MovieList';

const TopRatedMovies = () => {
  return <MovieList title="Maiores Avaliações" fetchFunction={fetchTopRatedMovies} />;
};

export default TopRatedMovies;
