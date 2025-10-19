import React from 'react';
import { fetchUpcomingMovies } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';

const UpcomingMovies = () => (
  <>
    <PageSEO
      title="Em Breve"
      description="Fique por dentro dos próximos lançamentos e prepare sua lista de filmes para assistir em breve."
      url="/upcoming-movies"
    />
    <MovieList title="Em Breve" fetchFunction={fetchUpcomingMovies} queryKey="upcoming" />
  </>
);

export default UpcomingMovies;


