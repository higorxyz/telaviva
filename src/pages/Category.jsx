import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchMoviesByCategory, fetchCategories } from '../api';
import MovieCard from '../components/MovieCard';
import { waveform } from 'ldrs';

waveform.register();

const Category = () => {
  const { category } = useParams();
  const [movies, setMovies] = useState([]);
  const [categoryName, setCategoryName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getMoviesByCategory = async () => {
      try {
        const moviesData = await fetchMoviesByCategory(category);
        setMovies(moviesData);
      } catch (err) {
        setError('Erro ao carregar os filmes.');
      } finally {
        setLoading(false);
      }
    };

    const getCategoryName = async () => {
      const categories = await fetchCategories();
      const matchedCategory = categories.find((cat) => cat.id.toString() === category);
      setCategoryName(matchedCategory ? matchedCategory.name : 'Categoria');
    };

    getMoviesByCategory();
    getCategoryName();
  }, [category]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      <l-waveform size="35" stroke="3.5" speed="1" color="red"></l-waveform>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-red-500">
      <p>{error}</p>
    </div>
  );

  return (
    <div className="p-6 bg-neutral-950 text-white">
      <h1 className="text-4xl font-bold mb-4">{categoryName}</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} />
        ))}
      </div>
    </div>
  );
};

export default Category;
