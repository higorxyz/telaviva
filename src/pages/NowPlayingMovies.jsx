import React, { useState, useEffect } from 'react';
import { fetchNowPlayingMovies } from '../api';
import MovieCard from '../components/MovieCard';
import Loading from '../components/Loading';

const NowPlayingMovies = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const getMovies = async () => {
      try {
        setLoadingMore(true);
        const nowPlayingData = await fetchNowPlayingMovies(page);
        setMovies((prevMovies) => [...prevMovies, ...nowPlayingData]);
      } catch (err) {
        setError('Erro ao carregar os filmes.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };
    getMovies();
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

  if (loading && page === 1) return <Loading />;
  if (error) return <div className="text-red-500 text-center mt-6">{error}</div>;

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10">
      <h1 className="text-4xl font-bold my-8 md:mx-6 lg:mx-8 xl:mx-10">
        Em Cartaz
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
          <Loading />
        </div>
      )}
    </div>
  );
};

export default NowPlayingMovies;
