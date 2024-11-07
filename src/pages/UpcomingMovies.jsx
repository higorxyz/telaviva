import React, { useEffect, useState } from 'react';
import { fetchUpcomingMovies } from '../api';
import MovieCard from '../components/MovieCard';
import { waveform } from 'ldrs';

waveform.register();

const UpcomingMovies = () => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getMovies = async () => {
      try {
        const movieData = await fetchUpcomingMovies();
        setMovies(movieData);
      } catch (err) {
        setError('Erro ao carregar os filmes.');
      } finally {
        setLoading(false);
      }
    };
    getMovies();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <l-waveform size="35" stroke="3.5" speed="1" color="red"></l-waveform>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-red-500">
      <p>{error}</p>
    </div>
  );

  return (
    <div className="p-6 bg-neutral-950 text-white">
      <h1 className="text-4xl font-bold mb-4">Filmes Futuros</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  );
};

export default UpcomingMovies;
