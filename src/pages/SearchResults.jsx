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

  useEffect(() => {
    const getSearchResults = async () => {
      if (query) {
        setLoading(true);
        setSearchResults([]);
        setPage(1);
        const results = await fetchMoviesBySearch(query, 1);
        setSearchResults(results);
        setHasMore(results.length > 0);
        setLoading(false);
      }
    };
    getSearchResults();
  }, [query]);

  useEffect(() => {
    const loadMoreResults = async () => {
      if (page > 1 && hasMore && !loading) {
        setLoading(true);
        const results = await fetchMoviesBySearch(query, page);
        setSearchResults((prevResults) => [...prevResults, ...results]);
        setHasMore(results.length > 0);
        setLoading(false);
      }
    };
    loadMoreResults();
  }, [page]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop + 100 >=
        document.documentElement.scrollHeight
      ) {
        setPage((prevPage) => prevPage + 1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10">
      <h1 className="text-3xl font-bold text-[#bd0003] mb-6">Resultados</h1>
      {loading && page === 1 ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {searchResults.length === 0 ? (
            <p className="col-span-full text-center text-red-500">Nenhum resultado encontrado.</p>
          ) : (
            searchResults.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))
          )}
        </div>
      )}
      {loading && page > 1 && (
        <div className="flex justify-center py-6">
          <Loading />
        </div>
      )}
    </div>
  );
};

export default SearchResults;
