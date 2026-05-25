import React, { useEffect, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import ErrorMessage from '../../../components/feedback/ErrorMessage';
import Loading from '../../../components/feedback/Loading';
import useIntersectionObserver from '../../../hooks/useIntersectionObserver';
import MovieCard from './MovieCard';
import MovieCardSkeleton from './MovieCardSkeleton';

const MovieList = ({
  title,
  fetchFunction,
  queryKey,
  headerContent = null,
  transformPageMovies = null,
  transformMovies = null,
  emptyStateTitle = 'Nenhum filme encontrado',
  emptyStateDescription = 'Não há filmes disponíveis nesta categoria.',
  showResultCount = false,
  disableInfiniteScroll = false,
}) => {
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

  const movies = useMemo(() => {
    if (!Array.isArray(data?.pages)) {
      return [];
    }

    return data.pages.flatMap((page) => {
      const pageResults = Array.isArray(page?.results) ? page.results : [];

      if (typeof transformPageMovies !== 'function') {
        return pageResults;
      }

      return transformPageMovies(pageResults);
    });
  }, [data, transformPageMovies]);
  const totalResultsFromApi = useMemo(() => {
    const firstPage = data?.pages?.[0];
    const totalResults = firstPage?.totalResults;

    return Number.isFinite(totalResults) ? totalResults : 0;
  }, [data]);

  const resultCountText = useMemo(() => {
    if (!showResultCount) {
      return null;
    }

    const count = totalResultsFromApi;
    return `${count} ${count === 1 ? 'resultado encontrado' : 'resultados encontrados'}`;
  }, [showResultCount, totalResultsFromApi]);

  const visibleMovies = useMemo(() => {
    if (typeof transformMovies !== 'function') {
      return movies;
    }

    return transformMovies(movies);
  }, [movies, transformMovies]);

  const canLoadMore = Boolean(hasNextPage) && !disableInfiniteScroll;

  useEffect(() => {
    if (isVisible && canLoadMore && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [canLoadMore, fetchNextPage, isFetchingNextPage, isVisible]);

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
      <div className="min-h-screen bg-black text-white pt-24 pb-20">
        <div className="max-w-[2000px] mx-auto">
          <div className="px-4 md:px-6 lg:px-8 xl:px-10 mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2">{title}</h1>
            {resultCountText ? <p className="text-sm md:text-base text-gray-400">{resultCountText}</p> : null}
            {headerContent ? <div className="mt-5">{headerContent}</div> : null}
          </div>

          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="text-6xl mb-4">🎬</div>
              <h2 className="text-2xl font-bold mb-2">{emptyStateTitle}</h2>
              <p className="text-gray-400">{emptyStateDescription}</p>
            </div>
          </div>
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
          {resultCountText ? <p className="text-sm md:text-base text-gray-400">{resultCountText}</p> : null}
          {headerContent ? <div className="mt-5">{headerContent}</div> : null}
        </div>

        {visibleMovies.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4 lg:gap-6 px-4 md:px-6 lg:px-8 xl:px-10">
            {visibleMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        ) : (
          <div className="px-4 md:px-6 lg:px-8 xl:px-10">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
              <h2 className="text-xl font-semibold text-white">Nenhum filme corresponde aos filtros selecionados</h2>
              <p className="mt-2 text-sm text-gray-400">
                {canLoadMore
                  ? 'Ajuste os filtros para ampliar os resultados ou continue navegando para ver mais filmes.'
                  : 'Ajuste os filtros para ampliar os resultados.'}
              </p>
            </div>
          </div>
        )}

        {canLoadMore ? <div ref={sentinelRef} className="h-20" aria-hidden="true" /> : null}

        {isFetchingNextPage && !disableInfiniteScroll && (
          <div className="flex justify-center items-center py-8">
            <div className="flex flex-col items-center gap-3">
              <Loading fullScreen={false} backgroundClass="bg-transparent" size={32} />
              <p className="text-sm text-gray-400">Carregando mais filmes...</p>
            </div>
          </div>
        )}

        {!hasNextPage && visibleMovies.length > 0 && (
          <div className="flex flex-col items-center py-12">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-tv-accent to-transparent rounded-full mb-4" />
            <p className="text-sm md:text-base text-gray-400 text-center">
              Você visualizou todos os filmes disponíveis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieList;