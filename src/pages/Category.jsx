import React, { useEffect, useState, useRef } from 'react';
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

  const moviesRef = useRef(null);

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

  const scrollLeft = () => {
    if (moviesRef.current) {
      moviesRef.current.scrollBy({
        left: -300,
        behavior: 'smooth',
      });
    }
  };

  const scrollRight = () => {
    if (moviesRef.current) {
      moviesRef.current.scrollBy({
        left: 300,
        behavior: 'smooth',
      });
    }
  };

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
      <div className="flex items-center relative">
        <button onClick={scrollLeft} className="absolute left-0 -translate-x-1/2 transform p-4 bg-[#bd0003] rounded-full hover:bg-red-500">
          ←
        </button>
        <div ref={moviesRef} className="flex overflow-x-auto space-x-4 pb-4">
          {movies.map((movie) => (
            <div key={movie.id} className="flex-shrink-0 w-48 sm:w-48 md:w-48 lg:w-56 xl:w-64">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
        <button onClick={scrollRight} className="absolute right-0 translate-x-1/2 transform p-4 bg-[#bd0003] rounded-full hover:bg-red-500">
          →
        </button>
      </div>
    </div>
  );
};

export default Category;