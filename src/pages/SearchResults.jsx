import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchMoviesBySearch } from '../api';
import Loading from '../components/Loading';

const SearchResults = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const location = useLocation();
  const query = new URLSearchParams(location.search).get('query');

  useEffect(() => {
    const getSearchResults = async () => {
      if (query) {
        setLoading(true);
        const results = await fetchMoviesBySearch(query, page);
        setSearchResults(prevResults => [...prevResults, ...results]);
        setHasMore(results.length > 0);
        setLoading(false);
      }
    };

    getSearchResults();
  }, [query, page]);

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight === e.target.scrollTop + e.target.clientHeight;
    if (bottom && !loading && hasMore) {
      setPage(prevPage => prevPage + 1);
    }
  };

  return (
    <div className="px-6 py-8" onScroll={handleScroll}>
      <h1 className="text-3xl font-bold text-[#bd0003] mb-6">Resultados</h1>
      {loading && page === 1 ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {searchResults.length === 0 ? (
            <p>Nenhum resultado encontrado.</p>
          ) : (
            searchResults.map((movie) => (
              <div key={movie.id} className="bg-neutral-900 text-white rounded-lg p-4">
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  className="w-full h-72 object-cover rounded-md"
                />
                <h3 className="text-xl mt-4">{movie.title}</h3>
              </div>
            ))
          )}
        </div>
      )}
      {loading && page > 1 && <Loading />}
    </div>
  );
};

export default SearchResults;
