import React from 'react';
import { fetchPopularMovies } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';

const PopularMovies = () => (
  <>
    <PageSEO
      title="Filmes Populares"
      description="Veja os filmes mais populares do momento e descubra o que está chamando a atenção do público."
      url="/popular-movies"
    />
    <MovieList title="Filmes Populares" fetchFunction={fetchPopularMovies} queryKey="popular" />
  </>
);

export default PopularMovies;


