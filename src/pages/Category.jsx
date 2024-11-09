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
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const getMoviesByCategory = async () => {
      try {
        setLoadingMore(true);
        const moviesData = await fetchMoviesByCategory(category, page);
        setMovies((prevMovies) => [...prevMovies, ...moviesData]);
      } catch (err) {
        setError('Erro ao carregar os filmes.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    const getCategoryName = async () => {
      const categories = await fetchCategories();
      const matchedCategory = categories.find((cat) => cat.id.toString() === category);
      setCategoryName(matchedCategory ? matchedCategory.name : 'Categoria');
    };

    getMoviesByCategory();
    getCategoryName();
  }, [category, page]);

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop + 100 >=
        document.documentElement.scrollHeight
      ) {
        setPage((prevPage) => prevPage + 1);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <l-waveform size="35" stroke="3.5" speed="1" color="red"></l-waveform>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 text-white md:p-6 lg:p-8 xl:p-10">
      <h1 className="text-4xl font-bold my-8 md:mx-6 lg:mx-8 xl:mx-10">
        {categoryName}
      </h1>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:mx-6 lg:mx-8 xl:mx-10">
        {movies.map((movie) => (
          <div key={movie.id} className="flex-shrink-0">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
      {loadingMore && (
        <div className="flex justify-center py-6">
          <l-waveform size="25" stroke="3" speed="1" color="red"></l-waveform>
        </div>
      )}
    </div>
  );
};

export default Category;
