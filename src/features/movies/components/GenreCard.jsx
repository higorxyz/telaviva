import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMoviesByCategory } from '../api';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const GenreCard = ({ genre, index }) => {
  const { data: movieData, isLoading } = useQuery({
    queryKey: ['movie_for_genre', genre.id],
    queryFn: () => fetchMoviesByCategory(genre.id, 1),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60 * 24,
    select: (data) => data.results[index % data.results.length],
  });

  const posterUrl = movieData?.poster_path ? `${IMAGE_BASE_URL}${movieData.poster_path}` : null;

  return (
    <Link
      to={`/category/${genre.id}`}
      className="relative block aspect-[3/4] rounded-xl overflow-hidden group shadow-xl hover:shadow-2xl hover:shadow-tv-accent/20 transition-all duration-300"
    >
      {isLoading ? (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 animate-pulse" />
      ) : posterUrl ? (
        <>
          <img
            src={posterUrl}
            alt={`Filmes de ${genre.name}`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/80 group-hover:from-black/50 group-hover:via-black/40 group-hover:to-black/60 transition-all duration-300" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black" />
      )}

      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-tv-accent/10 via-transparent to-transparent" />

      <div className="absolute inset-0 border-2 border-transparent group-hover:border-tv-accent/50 rounded-xl transition-colors duration-300" />

      <div className="relative h-full flex flex-col items-center justify-center p-4 z-10">
        <h3 className="text-white text-lg sm:text-xl md:text-2xl font-bold text-center drop-shadow-lg transform transition-transform duration-300 group-hover:scale-105">
          {genre.name}
        </h3>

        <div className="mt-3 w-12 h-0.5 bg-tv-accent transform scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
      </div>

      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-tv-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Link>
  );
};

export default GenreCard;