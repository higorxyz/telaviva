import React from 'react';
import { Link } from 'react-router-dom';
import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';

const FALLBACK_POSTER_ALT = 'Poster não disponível';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

const buildPosterUrl = (posterPath) =>
  posterPath ? `${IMAGE_BASE_URL}/w500${posterPath}` : null;

const StarRating = ({ voteAverage }) => {
  const normalized = Number(voteAverage);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return <span className="text-xs text-gray-300">Avaliação indisponível</span>;
  }

  const rating = normalized / 2;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5" aria-label={`Avaliação ${rating.toFixed(1)} de 5`}>
      {Array.from({ length: fullStars }, (_, i) => (
        <FaStar key={`full-${i}`} className="text-yellow-400" size={16} />
      ))}
      
      {hasHalfStar && <FaStarHalfAlt className="text-yellow-400" size={16} />}
      
      {Array.from({ length: emptyStars }, (_, i) => (
        <FaRegStar key={`empty-${i}`} className="text-yellow-400" size={16} />
      ))}
      
      <span className="ml-1.5 text-sm text-white font-semibold">
        {rating.toFixed(1)}
      </span>
    </div>
  );
};

const MovieCard = ({ movie }) => {
  const posterUrl = buildPosterUrl(movie.poster_path);

  return (
    <Link
      to={`/movie/${movie.id}`}
      className="relative block group rounded-lg shadow-lg overflow-hidden aspect-[2/3] bg-neutral-800 transition-all duration-300 hover:shadow-2xl hover:shadow-tv-accent/20"
    >
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={movie.title}
          className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-110"
        />
      ) : (
        <div className="w-full h-full bg-neutral-700 flex items-center justify-center text-center px-4">
          <span className="text-sm text-gray-300">{FALLBACK_POSTER_ALT}</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out flex flex-col justify-end p-4">
        <h3 className="text-white text-xl font-semibold line-clamp-2 mb-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 ease-in-out">
          {movie.title}
        </h3>
        <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300 ease-in-out delay-100">
          <StarRating voteAverage={movie.vote_average} />
        </div>
      </div>
    </Link>
  );
};

export default MovieCard;