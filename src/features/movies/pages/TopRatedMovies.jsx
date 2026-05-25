import React from 'react';
import { fetchTopRatedMovies } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';

const TopRatedMovies = () => (
  <>
    <PageSEO
      title="Filmes Mais Avaliados"
      description="Veja os filmes mais bem avaliados pela crítica e pelo público."
      url="/top-rated"
    />
    <MovieList title="Maiores avaliações" fetchFunction={fetchTopRatedMovies} queryKey="top-rated" />
  </>
);

export default TopRatedMovies;