import React, { useContext, useState, useEffect } from 'react';
import { MovieContext } from '../context/MovieContext';
import MovieCard from '../components/MovieCard';
import Loading from '../components/Loading';

const WatchedMovies = () => {
  const { watchedMovies } = useContext(MovieContext);
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(15);

  
  useEffect(() => {
    if (watchedMovies.length === 0) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  }, [watchedMovies]);

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

  const displayedMovies = watchedMovies.slice(0, visibleCount);

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10">
      <h1 className="text-4xl font-bold my-8 md:mx-6 lg:mx-8 xl:mx-10">
        Assistidos
      </h1>

      {watchedMovies.length === 0 ? (
        <p className="md:mx-6 lg:mx-8 xl:mx-10">Nenhum filme na lista de assistidos.</p>
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

export default WatchedMovies;