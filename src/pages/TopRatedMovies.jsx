import React, { useEffect, useState } from 'react';
import { fetchTopRatedMovies } from '../api';
import MovieCard from '../components/MovieCard';
import { waveform } from 'ldrs';

waveform.register();

const TopRatedMovies = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getMovies = async () => {
      try {
        const movieData = await fetchTopRatedMovies();
        setMovies(movieData);
      } catch (err) {
        setError('Erro ao carregar os filmes.');
      } finally {
        setLoading(false);
      }
    };
    getMovies();
  }, []);

  if (loading) {
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
        Maiores Avaliações
      </h1>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:mx-6 lg:mx-8 xl:mx-10">
        {movies.map((movie) => (
          <div key={movie.id} className="flex-shrink-0">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopRatedMovies;