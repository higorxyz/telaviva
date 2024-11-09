import React, { useState, useEffect } from 'react';
import { fetchNowPlayingMovies } from '../api';
import MovieCard from '../components/MovieCard';
import Loading from '../components/Loading';

const NowPlayingMovies = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(15);

  useEffect(() => {
    const getMovies = async () => {
      try {
        const nowPlayingData = await fetchNowPlayingMovies();
        setMovies(nowPlayingData);
      } catch (err) {
        setError('Erro ao carregar os filmes.');
      } finally {
        setLoading(false);
      }
    };
    getMovies();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight) return;
      setVisibleCount((prevCount) => prevCount + 15);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="text-red-500 text-center mt-6">{error}</div>;

  const displayedMovies = movies.slice(0, visibleCount);

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10">
      <h1 className="text-4xl font-bold my-8 md:mx-6 lg:mx-8 xl:mx-10">
        Em Cartaz
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:mx-6 lg:mx-8 xl:mx-10">
        {displayedMovies.map((movie) => (
          <div key={movie.id} className="flex-shrink-0">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default NowPlayingMovies;