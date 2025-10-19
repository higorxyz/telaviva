import React, { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import Loading from '../../../components/feedback/Loading';
import useIntersectionObserver from '../../../hooks/useIntersectionObserver';
import MovieCard from './MovieCard';
import MovieCardSkeleton from './MovieCardSkeleton';

const MovieList = ({ title, fetchFunction, queryKey }) => {
  const { targetRef: sentinelRef, isVisible } = useIntersectionObserver({
    rootMargin: '200px 0px',
  });

  const { data, status, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['movies-list', queryKey || title],
    queryFn: ({ pageParam = 1 }) => fetchFunction(pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const movies = useMemo(() => data?.pages.flatMap((page) => page.results) ?? [], [data]);
  const totalResults = useMemo(() => data?.pages[0]?.totalResults ?? 0, [data]);

  useEffect(() => {
    if (isVisible && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isVisible]);

  if (status === 'pending') {
    return (
      <div className="min-h-screen bg-black text-white pt-24 pb-8">
        <div className="max-w-[2000px] mx-auto">
          <div className="px-4 md:px-6 lg:px-8 xl:px-10 mb-8">
            <div className="h-10 w-64 bg-neutral-800 rounded-lg animate-pulse" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4 lg:gap-6 px-4 md:px-6 lg:px-8 xl:px-10">
            {Array.from({ length: 15 }).map((_, index) => (
              <MovieCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-24 pb-20">
        <ErrorMessage message={error instanceof Error ? error.message : 'Erro ao carregar os filmes.'} />
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center pt-24 pb-20">
        <div className="text-center">
          <div className="text-6xl mb-4">🎬</div>
          <h2 className="text-2xl font-bold mb-2">Nenhum filme encontrado</h2>
          <p className="text-gray-400">Não há filmes disponíveis nesta categoria.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-8">
      <div className="max-w-[2000px] mx-auto">
        <div className="px-4 md:px-6 lg:px-8 xl:px-10 mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2">
            {title}
          </h1>
          {totalResults > 0 && (
            <p className="text-sm md:text-base text-gray-400">
              {totalResults.toLocaleString('pt-BR')} {totalResults === 1 ? 'filme encontrado' : 'filmes encontrados'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4 lg:gap-6 px-4 md:px-6 lg:px-8 xl:px-10">
          {movies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>

        <div ref={sentinelRef} className="h-20" aria-hidden="true" />

        {isFetchingNextPage && (
          <div className="flex justify-center items-center py-8">
            <div className="flex flex-col items-center gap-3">
              <Loading fullScreen={false} backgroundClass="bg-transparent" size={32} />
              <p className="text-sm text-gray-400">Carregando mais filmes...</p>
            </div>
          </div>
        )}

        {!hasNextPage && movies.length > 0 && (
          <div className="flex flex-col items-center py-12">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-tv-accent to-transparent rounded-full mb-4" />
            <p className="text-sm md:text-base text-gray-400 text-center">
              Você visualizou todos os {movies.length} filmes disponíveis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieList;