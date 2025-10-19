import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchPopularMovies } from '../api';
import Loading from '../../../components/feedback/Loading';
import ErrorMessage from '../../../components/feedback/ErrorMessage';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original';

const Hero = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['movies', 'popular', 1],
    queryFn: () => fetchPopularMovies(1),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 120, // 2 hours
  });

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

  const featuredMovie = data?.results?.[0];

  if (!featuredMovie) {
    return null;
  }

  const backdropUrl = `${IMAGE_BASE_URL}${featuredMovie.backdrop_path}`;

  return (
    <div
      className="relative w-full h-[75vh] bg-cover bg-center bg-no-repeat text-white"
      style={{ backgroundImage: `url(${backdropUrl})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="relative z-10 flex flex-col justify-center h-full px-8 md:px-16 lg:px-24 w-full md:w-3/5 lg:w-1/2">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold drop-shadow-lg">
          {featuredMovie.title}
        </h1>
        <p className="mt-4 text-lg line-clamp-3 drop-shadow-md">
          {featuredMovie.overview}
        </p>
        <Link
          to={`/movie/${featuredMovie.id}`}
          className="mt-8 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 w-fit"
        >
          Ver Detalhes
        </Link>
      </div>
    </div>
  );
};

export default Hero;


