import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchPopularMovies } from '../api';
import Loading from '../../../components/feedback/Loading';
import ErrorMessage from '../../../components/feedback/ErrorMessage';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

const HERO_TITLE_VARIANTS = {
  balanced: 'text-[clamp(3.1rem,8vw,7rem)] leading-[0.9] tracking-[0.035em]',
  compact: 'text-[clamp(2.9rem,7.3vw,6.5rem)] leading-[0.94] tracking-[0.02em]',
  epic: 'text-[clamp(3.4rem,8.8vw,7.6rem)] leading-[0.86] tracking-[0.055em]',
};

const ACTIVE_HERO_TITLE_VARIANT = 'compact';

const Hero = () => {
  const [isBackdropLoaded, setIsBackdropLoaded] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['movies', 'popular', 1],
    queryFn: () => fetchPopularMovies(1),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 120, // 2 hours
  });

  const featuredMovie = data?.results?.[0] ?? null;
  const backdropUrl = featuredMovie?.backdrop_path
    ? `${IMAGE_BASE_URL}${featuredMovie.backdrop_path}`
    : null;
  const heroTitleClass =
    HERO_TITLE_VARIANTS[ACTIVE_HERO_TITLE_VARIANT] ?? HERO_TITLE_VARIANTS.balanced;

  useEffect(() => {
    setIsBackdropLoaded(false);
  }, [backdropUrl]);

  if (isLoading) {
    return (
      <div className="w-full h-[60vh] bg-neutral-800 flex items-center justify-center">
        <Loading fullScreen={false} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[60vh] bg-neutral-800 flex items-center justify-center">
        <ErrorMessage message="Não foi possível carregar o destaque." />
      </div>
    );
  }

  if (!featuredMovie || !backdropUrl) {
    return null;
  }

  return (
    <div
      className="relative w-full h-[75vh] overflow-hidden bg-neutral-900 text-white"
    >
      <img
        src={backdropUrl}
        alt=""
        aria-hidden="true"
        loading="eager"
        fetchPriority="high"
        decoding="async"
        onLoad={() => setIsBackdropLoaded(true)}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          isBackdropLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute inset-0 bg-neutral-900 transition-opacity duration-500 ${
          isBackdropLoaded ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 w-full md:w-3/5 lg:w-1/2">
        <h1 className={`font-display uppercase drop-shadow-[0_8px_24px_rgba(0,0,0,0.55)] ${heroTitleClass}`}>
          {featuredMovie.title}
        </h1>
        <p className="mt-4 line-clamp-3 text-base font-light leading-relaxed text-gray-100 drop-shadow-md md:text-lg">
          {featuredMovie.overview}
        </p>
        <Link
          to={`/movie/${featuredMovie.id}`}
          className="btn-minimal-rect mt-8 inline-flex w-fit items-center gap-2 rounded-lg px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] md:text-sm"
        >
          Ver Detalhes
          <svg
            className="h-4 w-4"
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
      </div>
    </div>
  );
};

export default Hero;


