import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchMoviesByCategory } from '../api';

const Category = () => {
  const { category } = useParams();
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    const getMoviesByCategory = async () => {
      const moviesData = await fetchMoviesByCategory(category);
      setMovies(moviesData);
    };
    getMoviesByCategory();
  }, [category]);

  return (
    <div className="p-6 bg-neutral-950 min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-4">Filmes em {category}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {movies.map(movie => (
          <div key={movie.id} className="bg-neutral-800 rounded-lg p-4">
            <img src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`} alt={movie.title} className="rounded-md mb-2" />
            <h2 className="text-xl font-semibold">{movie.title}</h2>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Category;
