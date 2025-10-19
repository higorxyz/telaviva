import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchMoviesBySearch } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query');

  return (
    <>
      <PageSEO
        title={`Resultados para "${query}"`}
        description={`Veja os resultados da busca por "${query}".`}
        url={`/search-results?query=${query}`}
      />
      <MovieList title={`Resultados para "${query}"`} fetchFunction={(page) => fetchMoviesBySearch(query, page)} queryKey={['search', query]} />
    </>
  );
};

export default SearchResults;