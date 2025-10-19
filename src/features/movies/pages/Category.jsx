import React, { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMoviesByCategory, fetchCategories } from '../api';
import MovieList from '../components/MovieList';
import PageSEO from '../../../components/seo/PageSEO';

const Category = () => {
  const { category } = useParams();

  const { data: categoriesData } = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const categoryName = categoriesData?.find((cat) => cat.id.toString() === category)?.name || 'Categoria';

  const fetchCategoryMovies = useCallback(
    (page) => fetchMoviesByCategory(category, page),
    [category]
  );

  const seoDescription =
    categoryName === 'Categoria'
      ? 'Veja filmes separados por categoria na TelaViva.'
      : `Confira os melhores títulos do gênero ${categoryName}.`;

  return (
    <>
      <PageSEO title={categoryName} description={seoDescription} url={`/category/${category}`} />
      <MovieList title={categoryName} fetchFunction={fetchCategoryMovies} queryKey={`category-${category}`} />
    </>
  );
};

export default Category;


