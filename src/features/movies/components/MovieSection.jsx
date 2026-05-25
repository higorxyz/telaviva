import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MovieCard from './MovieCard';

const SCROLL_OFFSET = 300;
const DRAG_THRESHOLD = 4;

const MovieSection = ({ title, movies, linkTo, showViewAll = true }) => {
  const scrollRef = useRef(null);
  const dragCleanupRef = useRef(null);
  const dragAnimationFrameRef = useRef(null);
  const pendingScrollLeftRef = useRef(null);
  const suppressClickRef = useRef(false);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = element;
    const nextCanScrollLeft = scrollLeft > 0;
    const nextCanScrollRight = scrollLeft + clientWidth < scrollWidth - 1;

    setCanScrollLeft((previous) => (previous === nextCanScrollLeft ? previous : nextCanScrollLeft));
    setCanScrollRight((previous) => (previous === nextCanScrollRight ? previous : nextCanScrollRight));
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

  const handleMouseDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();

    const element = scrollRef.current;
    if (!element) {
      return;
    }

    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }

    const startX = event.clientX;
    const initialScrollLeft = element.scrollLeft;
    let hasMoved = false;

    suppressClickRef.current = false;
    setIsDragging(true);
    element.style.scrollSnapType = 'none';
    element.style.scrollBehavior = 'auto';

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;

      if (!hasMoved && Math.abs(deltaX) > DRAG_THRESHOLD) {
        hasMoved = true;
      }

      if (hasMoved) {
        moveEvent.preventDefault();
        pendingScrollLeftRef.current = initialScrollLeft - deltaX;

        if (dragAnimationFrameRef.current === null) {
          dragAnimationFrameRef.current = window.requestAnimationFrame(() => {
            if (scrollRef.current && pendingScrollLeftRef.current != null) {
              scrollRef.current.scrollLeft = pendingScrollLeftRef.current;
            }
            dragAnimationFrameRef.current = null;
          });
        }
      }
    };

    const clearDrag = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (dragAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(dragAnimationFrameRef.current);
        dragAnimationFrameRef.current = null;
      }

      pendingScrollLeftRef.current = null;
      element.style.scrollSnapType = '';
      element.style.scrollBehavior = '';
      setIsDragging(false);
    };

    const handleMouseUp = () => {
      clearDrag();
      dragCleanupRef.current = null;

      if (hasMoved) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }
    };

    dragCleanupRef.current = clearDrag;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleScrollClickCapture = (event) => {
    if (!suppressClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
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

  useEffect(() => () => {
    if (dragCleanupRef.current) {
      dragCleanupRef.current();
      dragCleanupRef.current = null;
    }
  }, []);

  return (
    <div className="mb-12">
      <div className="flex items-end justify-between gap-2 flex-wrap mb-4 sm:mb-6 px-4 md:px-6 lg:px-8">
        <h2 className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl uppercase tracking-[0.03em] leading-[0.92] text-white">
          {title}
        </h2>
        {showViewAll && linkTo ? (
          <Link
            to={linkTo}
            className="link-underline-action link-underline-action--section flex-shrink-0 text-sm font-semibold sm:text-base md:text-lg"
          >
            Ver Todos
            <svg
              className="link-underline-action__icon"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M5 12H19M19 12L12 5M19 12L12 19"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
          onMouseDown={handleMouseDown}
          onClickCapture={handleScrollClickCapture}
          onDragStart={(event) => event.preventDefault()}
          className={`flex overflow-x-auto gap-4 pb-4 px-4 md:px-6 lg:px-8 snap-x snap-mandatory md:snap-none scrollbar-hide select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
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


