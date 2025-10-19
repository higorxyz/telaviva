import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import MovieCard from '../components/MovieCard';
import PageSEO from '../../../components/seo/PageSEO';
import { MovieContext } from '../context/MovieContext';
import useIntersectionObserver from '../../../hooks/useIntersectionObserver';
import Loading from '../../../components/feedback/Loading';

const INITIAL_VISIBLE_COUNT = 24;
const PAGE_INCREMENT = 24;

const WatchedMovies = () => {
  const { watchedMovies } = useContext(MovieContext);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const { targetRef: sentinelRef, isVisible } = useIntersectionObserver({
    rootMargin: '200px 0px',
  });

  const hasMore = useMemo(() => visibleCount < watchedMovies.length, [visibleCount, watchedMovies.length]);

  const loadMoreMovies = useCallback(() => {
    if (!hasMore) return;
    
    setVisibleCount((prevCount) => {
      const nextCount = prevCount + PAGE_INCREMENT;
      return nextCount > watchedMovies.length ? watchedMovies.length : nextCount;
    });
  }, [hasMore, watchedMovies.length]);

  useEffect(() => {
    setVisibleCount((prevCount) => {
      if (watchedMovies.length === 0) {
        return INITIAL_VISIBLE_COUNT;
      }
      return Math.min(Math.max(INITIAL_VISIBLE_COUNT, prevCount), watchedMovies.length);
    });
  }, [watchedMovies]);

  useEffect(() => {
    if (isVisible && hasMore) {
      loadMoreMovies();
    }
  }, [isVisible, hasMore, loadMoreMovies]);

  const displayedMovies = useMemo(
    () => watchedMovies.slice(0, visibleCount),
    [watchedMovies, visibleCount]
  );

  const seoJsonLd = useMemo(() => {
    const base = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Filmes Assistidos',
      numberOfItems: watchedMovies.length,
    };

    if (watchedMovies.length === 0) {
      return base;
    }

    return {
      ...base,
      itemListElement: watchedMovies.slice(0, 20).map((movie, index) => ({
        '@type': 'Movie',
        position: index + 1,
        name: movie.title,
        url: `/movie/${movie.id}`,
      })),
    };
  }, [watchedMovies]);

  return (
    <>
      <PageSEO
        title="Assistidos"
        description="Gerencie os filmes que você já assistiu e acompanhe seu histórico na TelaViva."
        url="/watched-movies"
        jsonLd={seoJsonLd}
      />
      <div className="min-h-screen bg-black text-white pt-24 pb-8">
        <div className="max-w-[2000px] mx-auto">
          <div className="px-4 md:px-6 lg:px-8 xl:px-10 mb-8">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-2">
              Assistidos
            </h1>
            {watchedMovies.length > 0 && (
              <p className="text-sm md:text-base text-gray-400">
                {watchedMovies.length.toLocaleString('pt-BR')} {watchedMovies.length === 1 ? 'filme assistido' : 'filmes assistidos'}
              </p>
            )}
          </div>

          {watchedMovies.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-6xl mb-4">✓</div>
                <h2 className="text-2xl font-bold mb-2">Nenhum filme assistido</h2>
                <p className="text-gray-400">Comece a marcar os filmes que você já assistiu!</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 md:gap-4 lg:gap-6 px-4 md:px-6 lg:px-8 xl:px-10">
                {displayedMovies.map((movie) => (
                  <MovieCard key={movie.id} movie={movie} />
                ))}
              </div>

              <div 
                ref={sentinelRef} 
                className="h-20 flex items-center justify-center"
                aria-hidden="true"
              />

              {hasMore && isVisible && (
                <div className="flex justify-center items-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Loading fullScreen={false} backgroundClass="bg-transparent" size={32} />
                    <p className="text-sm text-gray-400">Carregando mais filmes...</p>
                  </div>
                </div>
              )}

              {!hasMore && watchedMovies.length > INITIAL_VISIBLE_COUNT && (
                <div className="flex flex-col items-center py-12">
                  <div className="w-16 h-1 bg-gradient-to-r from-transparent via-tv-accent to-transparent rounded-full mb-4" />
                  <p className="text-sm md:text-base text-gray-400 text-center">
                    Você visualizou todos os {watchedMovies.length} filmes assistidos
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default WatchedMovies;