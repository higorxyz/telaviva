import React, { useState, useEffect } from 'react';
import { fetchNowPlayingMovies } from '../api';
import MovieCard from '../components/MovieCard';
import { Link } from 'react-router-dom';
import Loading from '../components/Loading';

const NowPlayingMovies = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) return <Loading />;
  if (error) return <div className="text-red-500 text-center mt-6">{error}</div>;

  const displayedMovies = movies.slice(0, 12);

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10">
      <h1 className="text-4xl font-bold my-8 md:mx-6 lg:mx-8 xl:mx-10">
        Agora em Cartaz
        <Link to="/now-playing-movies" className="bg-[#bd0003] text-white py-1 px-3 rounded-full text-sm">
          Ver Todos
        </Link>
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
