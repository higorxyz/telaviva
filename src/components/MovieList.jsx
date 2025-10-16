import React, { useEffect, useState } from 'react';
import MovieCard from './MovieCard';
import { waveform } from 'ldrs';

waveform.register();

const MovieList = ({ title, fetchFunction }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const getMovies = async () => {
      try {
        setLoadingMore(true);
        const movieData = await fetchFunction(page);
        setMovies((prevMovies) => [...prevMovies, ...movieData]);
      } catch (err) {
        setError('Erro ao carregar os filmes.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };
    getMovies();
  }, [page, fetchFunction]);

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

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <l-waveform size="35" stroke="3.5" speed="1" color="red"></l-waveform>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10">
      <h1 className="text-4xl font-bold my-8 md:mx-6 lg:mx-8 xl:mx-10">
        {title}
      </h1>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:mx-6 lg:mx-8 xl:mx-10">
        {movies.map((movie) => (
          <div key={movie.id} className="flex-shrink-0">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
      {loadingMore && (
        <div className="flex justify-center py-6">
          <l-waveform size="25" stroke="3" speed="1" color="red"></l-waveform>
        </div>
      )}
    </div>
  );
};

export default MovieList;
