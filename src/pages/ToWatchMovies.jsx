import React, { useContext, useState, useEffect } from 'react';
import { MovieContext } from '../context/MovieContext';
import { Link } from 'react-router-dom';
import Loading from '../components/Loading';

const ToWatchMovies = () => {
  const { toWatchMovies } = useContext(MovieContext);
  const [loading, setLoading] = useState(true); 

  useEffect(() => {
    
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  if (loading) return <Loading />;

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10 min-h-screen">
      <h1 className="text-4xl font-bold my-8 md:mx-6 lg:mx-8 xl:mx-10">
        Ver Depois
      </h1>
      {toWatchMovies.length === 0 ? (
        <p className="md:mx-6 lg:mx-8 xl:mx-10">Nenhum filme na lista para ver.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:mx-6 lg:mx-8 xl:mx-10">
          {toWatchMovies.map((movie) => (
            <div key={movie.id} className="flex-shrink-0">
              <div className="bg-neutral-800 p-4 rounded-md transition-transform transform hover:scale-105">
                <h2 className="text-lg font-bold">{movie.title}</h2>
                <p>Avaliação: {movie.vote_average}</p>
                <Link to={`/movie/${movie.id}`} className="text-[#bd0003] hover:underline">Ver detalhes</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToWatchMovies;