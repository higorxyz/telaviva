import React from 'react';
import { Link } from 'react-router-dom';

const MovieCard = ({ movie }) => {
  const rating = Math.round(movie.vote_average / 2); 
  const stars = Array(5).fill(0).map((_, index) => index < rating ? '★' : '☆').join('');

  return (
    <Link to={`/movie/${movie.id}`} className="block bg-gray-800 rounded-md shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      <img
        src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
        alt={movie.title}
        className="w-full h-72 object-cover"
      />
      <div className="p-4">
        <h3 className="text-xl font-semibold">{movie.title}</h3>
        <div className="text-yellow-500 text-xl">{stars}</div>
      </div>
    </Link>
  );
};

export default MovieCard;
