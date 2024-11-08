import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchMoviesBySearch } from '../api';
import Loading from '../components/Loading';
import MovieCard from '../components/MovieCard';

const SearchResults = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const query = new URLSearchParams(location.search).get('query');

  useEffect(() => {
    const getSearchResults = async () => {
      if (query) {
        setLoading(true);
        const results = await fetchMoviesBySearch(query);
        setSearchResults(results);
        setLoading(false);
      }
    };

    getSearchResults();
  }, [query]);

  return (
    <div className="px-6 py-8">
      <h1 className="text-3xl font-bold text-[#bd0003] mb-6">Resultados</h1>
      {loading ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {searchResults.length === 0 ? (
            <p>Nenhum resultado encontrado.</p>
          ) : (
            searchResults.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SearchResults;
