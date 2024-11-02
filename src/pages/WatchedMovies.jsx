import React, { useContext } from 'react';
import { MovieContext } from '../context/MovieContext';
import { Link } from 'react-router-dom';

const WatchedMovies = () => {
  const { watchedMovies } = useContext(MovieContext);

  return (
    <div className="p-8 bg-neutral-950 text-white min-h-screen">
      <h1 className="text-4xl font-bold mb-4">Filmes Assistidos</h1>
      {watchedMovies.length === 0 ? (
        <p>Nenhum filme na lista de assistidos.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchedMovies.map((movie) => (
            <div key={movie.id} className="bg-neutral-800 p-4 rounded-md">
              <h2 className="text-lg font-bold">{movie.title}</h2>
              <p>Avaliação: {movie.vote_average}</p>
              <Link to={`/movie/${movie.id}`} className="text-[#bd0003] hover:underline">Ver detalhes</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WatchedMovies;
