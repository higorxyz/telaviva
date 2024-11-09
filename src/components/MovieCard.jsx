import React from 'react';
import { Link } from 'react-router-dom';

const MovieCard = ({ movie }) => {
  const rating = Math.round(movie.vote_average / 2);
  const stars = Array(5).fill(0).map((_, index) => index < rating ? '★' : '☆').join('');

  return (
    <Link 
      to={`/movie/${movie.id}`} 
      className="block bg-neutral-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow h-[400px]"
    >
      <img
        src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
        alt={movie.title}
        className="w-full h-[250px] object-cover" 
      />
      <div className="p-4 flex flex-col justify-between h-[150px]"> 
        <h3 className="text-xl font-semibold line-clamp-2 h-14 overflow-hidden">{movie.title}</h3>
        <div className="flex justify-start items-center mt-1">
          <div className="text-[#bd0003] text-lg">{stars}</div>
        </div>
      </div>
    </Link>
  );
};

export default MovieCard;