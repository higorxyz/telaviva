import React from 'react';
import { fetchUpcomingMovies } from '../api';
import MovieList from '../components/MovieList';

const UpcomingMovies = () => {
  return <MovieList title="Em Breve" fetchFunction={fetchUpcomingMovies} />;
};

export default UpcomingMovies;
