import React from 'react';
import { fetchNowPlayingMovies } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';

const NowPlayingMovies = () => (
  <>
    <PageSEO
      title="Em Cartaz"
      description="Explore os filmes que estão em cartaz nos cinemas e descubra as histórias do momento."
      url="/now-playing-movies"
    />
    <MovieList title="Filmes em cartaz" fetchFunction={fetchNowPlayingMovies} queryKey="now-playing" />
  </>
);

export default NowPlayingMovies;


