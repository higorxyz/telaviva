import React, { useContext, useState, useEffect } from 'react';
import { MovieContext } from '../context/MovieContext';
import MovieCard from '../components/MovieCard';
import Loading from '../components/Loading';

const ToWatchMovies = () => {
  const { toWatchMovies } = useContext(MovieContext);
  const [loading, setLoading] = useState(true); 
  const [visibleCount, setVisibleCount] = useState(15);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleScroll = () => {
    if (window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight) return;
    setVisibleCount((prevCount) => prevCount + 15);
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) return <Loading />;

  const displayedMovies = toWatchMovies.slice(0, visibleCount);

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10 min-h-screen">
      <h1 className="text-4xl font-bold my-8 md:mx-6 lg:mx-8 xl:mx-10">
        Ver Depois
      </h1>
      {toWatchMovies.length === 0 ? (
        <p className="md:mx-6 lg:mx-8 xl:mx-10">Nenhum filme na lista para ver.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:mx-6 lg:mx-8 xl:mx-10">
          {displayedMovies.map((movie) => (
            <div key={movie.id} className="flex-shrink-0">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ToWatchMovies;