import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MovieCard from './MovieCard';

const SCROLL_OFFSET = 300;

const MovieSection = ({ title, movies, linkTo, showViewAll = true }) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = element;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  const handleScroll = (direction) => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    element.scrollBy({
      left: direction === 'left' ? -SCROLL_OFFSET : SCROLL_OFFSET,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    updateScrollState();
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);

    return () => {
      element.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [movies, updateScrollState]);

  return (
    <div className="mb-12">
      <div className="flex justify-between items-center mb-6 px-4 md:px-6 lg:px-8">
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
          {title}
        </h2>
        {showViewAll && linkTo ? (
          <Link
            to={linkTo}
            className="bg-tv-accent text-white py-2 px-4 md:py-2 md:px-6 rounded-lg text-sm md:text-base font-medium hover:bg-tv-accent-hover transition-colors"
          >
            Ver Todos
          </Link>
        ) : null}
      </div>
      <div className="relative">
        {}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/80 backdrop-blur-sm text-white rounded-full hover:bg-tv-accent transition-all hover:opacity-100 opacity-80"
            aria-label="Scroll para esquerda"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {}
        <div 
          ref={scrollRef} 
          className="flex overflow-x-auto gap-4 pb-4 px-4 md:px-6 lg:px-8 snap-x snap-mandatory scroll-smooth scrollbar-hide"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {movies.map((movie) => (
            <div 
              key={movie.id} 
              className="flex-shrink-0 w-40 sm:w-44 md:w-48 lg:w-56 xl:w-64 snap-start"
            >
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>

        {}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 p-3 bg-black/80 backdrop-blur-sm text-white rounded-full hover:bg-tv-accent transition-all hover:opacity-100 opacity-80"
            aria-label="Scroll para direita"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {}
        <div className="md:hidden flex justify-center gap-1 mt-2">
          {canScrollLeft && (
            <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
          )}
          <div className="w-2 h-2 rounded-full bg-tv-accent" />
          {canScrollRight && (
            <div className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
};

export default MovieSection;


