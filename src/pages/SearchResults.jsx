import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchMoviesBySearch } from '../api';
import Loading from '../components/Loading';
import MovieCard from '../components/MovieCard';

const SearchResults = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const location = useLocation();
  const query = new URLSearchParams(location.search).get('query');

  const fetchAllResults = async () => {
    setLoading(true);
    try {
      const results = await fetchMoviesBySearch(query, page);
      setSearchResults((prevResults) => [...prevResults, ...results]);

      if (results.length === 0) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error fetching search results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      setSearchResults([]);
      setPage(1);
      setHasMore(true);
      fetchAllResults();
    }
  }, [query]);

  useEffect(() => {
    if (page > 1) {
      fetchAllResults();
    }
  }, [page]);

  const handleLoadMore = () => {
    setPage((prevPage) => prevPage + 1);
  };

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
      {hasMore && !loading && (
        <div className="text-center mt-6">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2 bg-[#bd0003] text-white rounded-full"
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
