import React from 'react';
import { fetchNowPlayingMovies } from '../api';
import MovieList from '../components/MovieList';

const NowPlayingMovies = () => {
  return <MovieList title="Em Cartaz" fetchFunction={fetchNowPlayingMovies} />;
};

export default NowPlayingMovies;
