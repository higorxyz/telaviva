import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import MovieCard from './MovieCard';

const MovieSection = ({ title, movies, linkTo, showViewAll = true }) => {
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: -300,
        behavior: 'smooth',
      });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: 300,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold my-8 flex justify-between items-center md:mx-6 lg:mx-8 xl:mx-10">
        {title}
        {showViewAll && linkTo && (
          <Link to={linkTo} className="bg-[#bd0003] text-white py-1 px-3 rounded-full text-sm">
            Ver Todos
          </Link>
        )}
      </h1>
      <div className="flex items-center relative">
        <button 
          onClick={scrollLeft} 
          className="absolute left-0 -translate-x-1/2 transform p-4 bg-[#bd0003] rounded-full hover:bg-red-500 z-10"
          aria-label="Rolar para esquerda"
        >
          ←
        </button>
        <div 
          ref={scrollRef} 
          className="flex overflow-x-auto space-x-4 pb-4 mx-0 md:mx-6 lg:mx-8 xl:mx-10"
        >
          {movies.map((movie) => (
            <div key={movie.id} className="flex-shrink-0 w-48 sm:w-48 md:w-48 lg:w-56 xl:w-64">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
        <button 
          onClick={scrollRight} 
          className="absolute right-0 translate-x-1/2 transform p-4 bg-[#bd0003] rounded-full hover:bg-red-500 z-10"
          aria-label="Rolar para direita"
        >
          →
        </button>
      </div>
    </div>
  );
};

export default MovieSection;
